import { CategoriaMovimientoFinanciero, PaymentMethod, PurchaseStatus, SaleType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ReportService } from './report.service';

const reportService = new ReportService();
const BOLIVIA_UTC_OFFSET_HOURS = 4;

function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || year < 2000) {
    throw Object.assign(new Error('Mes invalido'), { status: 400 });
  }
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1, BOLIVIA_UTC_OFFSET_HOURS)),
    end: new Date(Date.UTC(year, monthNumber, 1, BOLIVIA_UTC_OFFSET_HOURS)),
  };
}

const sum = <T>(items: T[], read: (item: T) => number) => items.reduce((total, item) => total + read(item), 0);

export class FinanceService {
  async getSummary(month: string) {
    const range = monthRange(month);
    const dateFilter = { gte: range.start, lt: range.end };
    const digitalMethods: PaymentMethod[] = ['QR', 'TRANSFERENCIA', 'TARJETA'];

    const [profitReport, cierres, ventasDigitales, cobrosDigitales, gastosQr, compras, movimientos, balance] = await Promise.all([
      reportService.getMonthlyProfitReport({ month }),
      prisma.cierreCaja.findMany({ where: { fecha: dateFilter }, select: { montoDeclarado: true } }),
      prisma.pagoVenta.findMany({
        where: {
          metodoPago: { in: digitalMethods },
          venta: { tipoVenta: SaleType.CONTADO, createdAt: dateFilter },
        },
        select: { monto: true, metodoPago: true },
      }),
      prisma.pagoCredito.findMany({
        where: { createdAt: dateFilter, metodoPago: { in: digitalMethods } },
        select: { monto: true, metodoPago: true },
      }),
      prisma.gastoCaja.findMany({
        where: { createdAt: dateFilter, metodoPago: PaymentMethod.QR },
        select: { monto: true },
      }),
      prisma.compra.findMany({
        where: { createdAt: dateFilter, estado: PurchaseStatus.RECIBIDA },
        select: { total: true },
      }),
      prisma.movimientoFinanciero.findMany({
        where: { fecha: dateFilter },
        include: {
          usuario: { select: { id: true, nombre: true } },
          sucursal: { select: { id: true, nombre: true } },
        },
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.balanceMensual.findUnique({ where: { mes: month } }),
    ]);

    const depositosEfectivo = sum(cierres, (item) => item.montoDeclarado);
    const ventasQr = sum(ventasDigitales.filter((item) => item.metodoPago === 'QR'), (item) => item.monto);
    const ventasTransferencia = sum(ventasDigitales.filter((item) => item.metodoPago === 'TRANSFERENCIA'), (item) => item.monto);
    const ventasTarjeta = sum(ventasDigitales.filter((item) => item.metodoPago === 'TARJETA'), (item) => item.monto);
    const cobrosQr = sum(cobrosDigitales.filter((item) => item.metodoPago === 'QR'), (item) => item.monto);
    const cobrosTransferencia = sum(cobrosDigitales.filter((item) => item.metodoPago === 'TRANSFERENCIA'), (item) => item.monto);
    const cobrosTarjeta = sum(cobrosDigitales.filter((item) => item.metodoPago === 'TARJETA'), (item) => item.monto);
    const gastosCajaQr = sum(gastosQr, (item) => item.monto);
    const comprasMercaderia = sum(compras, (item) => item.total);
    const gastosAdministrador = sum(movimientos.filter((item) => item.categoria === 'GASTO_NEGOCIO'), (item) => item.monto);
    const retirosPersonales = sum(movimientos.filter((item) => item.categoria === 'RETIRO_PERSONAL'), (item) => item.monto);
    const aportesPropietario = sum(movimientos.filter((item) => item.categoria === 'APORTE_PROPIETARIO'), (item) => item.monto);
    const ingresosBanco = depositosEfectivo + ventasQr + ventasTransferencia + ventasTarjeta + cobrosQr + cobrosTransferencia + cobrosTarjeta + aportesPropietario;
    const egresosBanco = gastosCajaQr + comprasMercaderia + gastosAdministrador + retirosPersonales;
    const saldoInicial = balance?.saldoInicial ?? 0;
    const saldoEsperado = saldoInicial + ingresosBanco - egresosBanco;
    const saldoReal = balance?.saldoReal ?? null;
    const diferenciaBanco = saldoReal === null ? null : saldoReal - saldoEsperado;
    const { gananciaNeta, margenNeto, totalVentas } = profitReport.totals;

    const estado = totalVentas <= 0
      ? { codigo: 'SIN_DATOS', titulo: 'Sin ventas suficientes', mensaje: 'Todavia no hay ventas para evaluar este mes.' }
      : gananciaNeta <= 0
        ? { codigo: 'CON_PERDIDAS', titulo: 'El negocio esta con perdidas', mensaje: 'Los costos y gastos superan lo vendido. Revisa gastos, precios y costos.' }
        : margenNeto < 10
          ? { codigo: 'ATENCION', titulo: 'El negocio requiere atencion', mensaje: 'Hay ganancia, pero el margen es bajo y deja poco espacio para imprevistos.' }
          : { codigo: 'VA_BIEN', titulo: 'El negocio va bien', mensaje: 'Las ventas cubren costos y gastos, y el mes mantiene una ganancia saludable.' };

    return {
      month,
      estado,
      rentabilidad: profitReport.totals,
      cuenta: {
        saldoInicial,
        ingresosBanco,
        egresosBanco,
        saldoEsperado,
        saldoReal,
        diferenciaBanco,
      },
      flujo: {
        depositosEfectivo,
        ventasQr,
        ventasTransferencia,
        ventasTarjeta,
        cobrosQr,
        cobrosTransferencia,
        cobrosTarjeta,
        aportesPropietario,
        gastosCajaQr,
        comprasMercaderia,
        gastosAdministrador,
        retirosPersonales,
      },
      movimientos,
    };
  }

  async createMovement(data: {
    categoria: CategoriaMovimientoFinanciero;
    descripcion: string;
    monto: number;
    fecha: string;
    sucursalId?: string | null;
    notas?: string | null;
    usuarioId: string;
  }) {
    return prisma.movimientoFinanciero.create({
      data: {
        categoria: data.categoria,
        descripcion: data.descripcion,
        monto: data.monto,
        fecha: new Date(`${data.fecha}T04:00:00.000Z`),
        sucursalId: data.sucursalId || null,
        notas: data.notas || null,
        usuarioId: data.usuarioId,
      },
      include: { usuario: { select: { id: true, nombre: true } }, sucursal: { select: { id: true, nombre: true } } },
    });
  }

  async deleteMovement(id: string) {
    const movement = await prisma.movimientoFinanciero.findUnique({ where: { id } });
    if (!movement) throw Object.assign(new Error('Movimiento no encontrado'), { status: 404 });
    await prisma.movimientoFinanciero.delete({ where: { id } });
    return movement;
  }

  async saveBalance(data: { mes: string; saldoInicial: number; saldoReal?: number | null; usuarioId: string }) {
    monthRange(data.mes);
    return prisma.balanceMensual.upsert({
      where: { mes: data.mes },
      update: { saldoInicial: data.saldoInicial, saldoReal: data.saldoReal ?? null, usuarioId: data.usuarioId },
      create: { mes: data.mes, saldoInicial: data.saldoInicial, saldoReal: data.saldoReal ?? null, usuarioId: data.usuarioId },
    });
  }
}
