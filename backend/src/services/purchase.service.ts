import { PaymentMethod, Prisma, PurchaseOrigin } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { StockService } from './stock.service';
import { PurchaseRecordService } from './purchase-record.service';

const stockService = new StockService();
const purchaseRecordService = new PurchaseRecordService();

export class PurchaseService {
  async getAll() {
    return prisma.compra.findMany({
      include: { proveedor: true, sucursal: true, usuario: { select: { id: true, nombre: true } }, pagos: true, detalles: { include: { producto: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addPayment(compraId: string, data: { monto: number; metodoPago: PaymentMethod; notas?: string | null; usuarioId: string }) {
    return prisma.$transaction(async (tx) => {
      const compra = await tx.compra.findUnique({ where: { id: compraId } });
      if (!compra) throw Object.assign(new Error('Compra no encontrada'), { status: 404 });
      if (compra.estado === 'ANULADA') throw Object.assign(new Error('No se puede pagar una compra anulada'), { status: 409 });

      const updated = await tx.compra.updateMany({
        where: {
          id: compraId,
          estado: { not: 'ANULADA' },
          saldoPendiente: { gte: data.monto },
        },
        data: {
          montoPagado: { increment: data.monto },
          saldoPendiente: { decrement: data.monto },
        },
      });
      if (updated.count !== 1) {
        throw Object.assign(new Error(`El pago excede el saldo pendiente de Bs ${compra.saldoPendiente}`), { status: 409 });
      }

      await tx.pagoCompra.create({
        data: { compraId, monto: data.monto, metodoPago: data.metodoPago, usuarioId: data.usuarioId, notas: data.notas || null },
      });
      const providerUpdated = await tx.proveedor.updateMany({
        where: { id: compra.proveedorId, deudaPendiente: { gte: data.monto } },
        data: { deudaPendiente: { decrement: data.monto } },
      });
      if (providerUpdated.count !== 1) {
        throw Object.assign(new Error('La deuda del proveedor no coincide con el saldo de la compra.'), { status: 409 });
      }

      const current = await tx.compra.findUniqueOrThrow({ where: { id: compraId } });
      const estadoPago = current.saldoPendiente <= 0.01 ? 'PAGADA' : 'PARCIAL';
      return tx.compra.update({
        where: { id: compraId },
        data: {
          saldoPendiente: current.saldoPendiente <= 0.01 ? 0 : current.saldoPendiente,
          estadoPago,
        },
        include: { proveedor: true, sucursal: true, pagos: true, detalles: { include: { producto: true } } },
      });
    });
  }

  async create(data: {
    proveedorId: string;
    sucursalId: string;
    usuarioId: string;
    notas?: string | null;
    metodoPago?: PaymentMethod | null;
    montoPagado?: number;
    fechaVencimiento?: string | null;
    comprobante?: string | null;
    tipoCambio?: number;
    items: { productoId: string; cantidad: number; precioUnitario: number; precioUnitarioReales?: number }[];
  }) {
    return prisma.$transaction(async (tx) => {
      const compra = await purchaseRecordService.create(tx, {
        proveedorId: data.proveedorId,
        sucursalId: data.sucursalId,
        usuarioId: data.usuarioId,
        items: data.items,
        origen: PurchaseOrigin.COMPRA_DIRECTA,
        tipoCambio: data.tipoCambio,
        montoPagado: data.montoPagado,
        metodoPago: data.metodoPago,
        fechaVencimiento: data.fechaVencimiento ? new Date(`${data.fechaVencimiento}T04:00:00.000Z`) : null,
        comprobante: data.comprobante,
        notas: data.notas,
      });

      for (const item of data.items) {
        const producto = await tx.producto.findUnique({
          where: { id: item.productoId },
          include: { stockSucursales: true },
        });
        if (!producto) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
        const branchStock = producto.stockSucursales.find((stock) => stock.sucursalId === data.sucursalId);
        const stockAnterior = branchStock?.stock ?? (producto.sucursalId === data.sucursalId ? producto.stock : 0);
        const stockNuevo = stockAnterior + item.cantidad;
        await tx.productoStockSucursal.upsert({
          where: { productoId_sucursalId: { productoId: item.productoId, sucursalId: data.sucursalId } },
          update: { stock: stockNuevo },
          create: {
            productoId: item.productoId,
            sucursalId: data.sucursalId,
            stock: stockNuevo,
          },
        });
        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stock: { increment: item.cantidad },
            precioCompra: item.precioUnitario,
            precioCompraReales: item.precioUnitarioReales ?? undefined,
            tipoCambioCompra: item.precioUnitarioReales != null ? data.tipoCambio : undefined,
            proveedorId: data.proveedorId,
          },
        });
        await stockService.recordMovement(tx, {
          tipoMovimiento: 'COMPRA',
          productoId: item.productoId,
          sucursalId: data.sucursalId,
          stockAnterior,
          stockNuevo,
          cantidad: item.cantidad,
          proveedorId: data.proveedorId,
          precioCompraUnitario: item.precioUnitario,
          precioCompraUnitarioReales: item.precioUnitarioReales,
          tipoCambio: data.tipoCambio,
          costoTotal: item.cantidad * item.precioUnitario,
          costoTotalReales: item.precioUnitarioReales ? item.cantidad * item.precioUnitarioReales : undefined,
          estante: branchStock?.ubicacion ?? producto.ubicacion,
          comprobante: data.comprobante,
          usuarioId: data.usuarioId,
          referenciaId: compra.id,
          referenciaTipo: 'COMPRA',
          notas: data.notas,
        });
      }

      return tx.compra.findUnique({
        where: { id: compra.id },
        include: { proveedor: true, sucursal: true, detalles: { include: { producto: true } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
