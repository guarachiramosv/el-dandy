import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';

const DAY = 86_400_000;
export function businessDayStart(now = new Date()): Date {
  const local = new Date(now.getTime() - 4 * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 4));
}

// A movement requires reconciliation even when its amount is zero.
export async function assertPreviousCashClosed(
  db: Prisma.TransactionClient, usuarioId: string, sucursalId: string, today = businessDayStart(),
) {
  const scope = { usuarioId, OR: [{ sucursalId }, { usuario: { sucursalId } }] };
  const [sales, expenses, payments, closings] = await Promise.all([
    db.venta.findMany({ where: { ...scope, fechaNegocio: { lt: today } }, select: { fechaNegocio: true } }),
    db.gastoCaja.findMany({ where: { ...scope, fechaNegocio: { lt: today } }, select: { fechaNegocio: true } }),
    db.pagoCredito.findMany({ where: { usuarioId, cuenta: { sucursalId }, fechaNegocio: { lt: today } }, select: { fechaNegocio: true } }),
    db.cierreCaja.findMany({ where: { ...scope, fecha: { lt: today } }, select: { fecha: true, estado: true } }),
  ]);
  const closed = new Set(closings.filter(c => c.estado !== 'OBSERVADO').map(c => businessDayStart(c.fecha).getTime()));
  const pending = [...sales, ...expenses, ...payments].map(m => businessDayStart(m.fechaNegocio).getTime())
    .concat(closings.filter(c => c.estado === 'OBSERVADO').map(c => businessDayStart(c.fecha).getTime()))
    .filter(day => !closed.has(day)).sort((a, b) => a - b)[0];
  if (pending !== undefined) {
    const date = new Date(pending).toISOString().slice(0, 10);
    throw Object.assign(new Error(`Primero debes cerrar o corregir la caja del ${date} antes de registrar operaciones de hoy.`), { status: 409 });
  }
}

export class AutomaticCashClosingService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async reconcile(now = new Date()) {
    const today = businessDayStart(now);
    const sellers = await this.db.usuario.findMany({ where: { role: 'SELLER', activo: true }, select: { id: true, sucursalId: true, createdAt: true } });
    for (const seller of sellers) {
      const scope = { usuarioId: seller.id, OR: [{ sucursalId: seller.sucursalId }, { usuario: { sucursalId: seller.sucursalId } }] };
      const [closings, sales, expenses, payments] = await Promise.all([
        this.db.cierreCaja.findMany({ where: scope, select: { fecha: true } }),
        this.db.venta.findMany({ where: scope, select: { fechaNegocio: true } }),
        this.db.gastoCaja.findMany({ where: scope, select: { fechaNegocio: true } }),
        this.db.pagoCredito.findMany({ where: { usuarioId: seller.id, cuenta: { sucursalId: seller.sucursalId } }, select: { fechaNegocio: true } }),
      ]);
      const occupied = new Set([
        ...closings.map(c => businessDayStart(c.fecha).getTime()),
        ...[...sales, ...expenses, ...payments].map(m => businessDayStart(m.fechaNegocio).getTime()),
      ]);
      // Recover missed days after server downtime, starting at account creation.
      for (let day = businessDayStart(seller.createdAt); day < today; day = new Date(day.getTime() + DAY)) {
        if (occupied.has(day.getTime())) continue;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await this.closeEmptyDay(seller, day);
            break;
          } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(error.code) || attempt === 2) throw error;
          }
        }
      }
    }
  }

  private async closeEmptyDay(seller: { id: string; sucursalId: string }, day: Date) {
    await this.db.$transaction(async tx => {
      const scope = { usuarioId: seller.id, OR: [{ sucursalId: seller.sucursalId }, { usuario: { sucursalId: seller.sucursalId } }] };
      if (await tx.cierreCaja.findFirst({ where: { ...scope, fecha: day }, select: { id: true } })) return;
      const fechaNegocio = { gte: day, lt: new Date(day.getTime() + DAY) };
      const movements = await Promise.all([
        tx.venta.count({ where: { ...scope, fechaNegocio } }),
        tx.gastoCaja.count({ where: { ...scope, fechaNegocio } }),
        tx.pagoCredito.count({ where: { usuarioId: seller.id, cuenta: { sucursalId: seller.sucursalId }, fechaNegocio } }),
      ]);
      if (movements.some(count => count > 0)) return;
      const note = 'Cierre automatico en Bs 0: jornada sin ventas, gastos ni cobros registrados.';
      await tx.cierreCaja.create({ data: {
        fecha: day, usuarioId: seller.id, sucursalId: seller.sucursalId,
        cantidadVentas: 0, totalVentas: 0, totalEfectivo: 0, totalTransferencia: 0,
        totalQr: 0, totalTarjeta: 0, totalCredito: 0, montoDeclarado: 0, diferencia: 0,
        estado: 'APROBADO', notas: note, revisadoAt: new Date(),
        historial: { create: { accion: 'APROBADO', actorId: seller.id, comentario: note,
          montoDeclarado: 0, efectivoEsperado: 0, diferencia: 0, version: 1,
          snapshot: { automatico: true, motivo: 'SIN_MOVIMIENTOS' } } },
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

export const automaticCashClosingService = new AutomaticCashClosingService();

export function startAutomaticCashClosings() {
  let running = false;
  let completedDay: number | undefined;
  const run = async () => {
    const day = businessDayStart().getTime();
    if (running || completedDay === day) return;
    running = true;
    try { await automaticCashClosingService.reconcile(); completedDay = day; }
    catch (error) { console.error('No se pudieron conciliar las cajas automaticas:', error); }
    finally { running = false; }
  };
  void run();
  const timer = setInterval(() => void run(), 60_000);
  timer.unref();
  return timer;
}
