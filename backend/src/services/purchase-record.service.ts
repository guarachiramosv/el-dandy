import { PaymentMethod, Prisma, PurchaseOrigin, PurchasePaymentStatus } from '@prisma/client';

export type PurchaseRecordItem = {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  precioUnitarioReales?: number;
};

export type PurchaseRecordInput = {
  proveedorId: string;
  sucursalId: string;
  usuarioId: string;
  items: PurchaseRecordItem[];
  origen: PurchaseOrigin;
  tipoCambio?: number;
  montoPagado?: number;
  metodoPago?: PaymentMethod | null;
  fechaVencimiento?: Date | null;
  comprobante?: string | null;
  notas?: string | null;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export class PurchaseRecordService {
  async create(tx: Prisma.TransactionClient, input: PurchaseRecordInput) {
    if (input.items.length === 0) {
      throw Object.assign(new Error('La compra debe contener al menos un producto.'), { status: 400 });
    }
    if (input.items.some((item) => item.cantidad <= 0 || item.precioUnitario < 0)) {
      throw Object.assign(new Error('Las cantidades deben ser positivas y los precios no pueden ser negativos.'), { status: 400 });
    }

    const provider = await tx.proveedor.findFirst({
      where: { id: input.proveedorId, activo: true },
      select: { id: true },
    });
    if (!provider) throw Object.assign(new Error('Proveedor no encontrado o inactivo'), { status: 404 });

    const details = input.items.map((item) => ({
      productoId: item.productoId,
      cantidad: item.cantidad,
      precioUnitario: roundMoney(item.precioUnitario),
      subtotal: roundMoney(item.cantidad * item.precioUnitario),
    }));
    const total = roundMoney(details.reduce((sum, item) => sum + item.subtotal, 0));
    const totalReales = roundMoney(input.items.reduce(
      (sum, item) => sum + item.cantidad * (item.precioUnitarioReales || 0),
      0,
    ));
    const montoPagado = roundMoney(input.montoPagado ?? total);
    if (montoPagado < 0 || montoPagado > total) {
      throw Object.assign(new Error('El monto pagado debe estar entre cero y el total de la compra.'), { status: 400 });
    }
    const saldoPendiente = roundMoney(total - montoPagado);
    const estadoPago = saldoPendiente === 0
      ? PurchasePaymentStatus.PAGADA
      : montoPagado === 0
        ? PurchasePaymentStatus.PENDIENTE
        : PurchasePaymentStatus.PARCIAL;
    if (saldoPendiente > 0 && !input.fechaVencimiento) {
      throw Object.assign(new Error('Indica la fecha de vencimiento cuando queda saldo pendiente.'), { status: 400 });
    }

    const purchase = await tx.compra.create({
      data: {
        proveedorId: input.proveedorId,
        sucursalId: input.sucursalId,
        usuarioId: input.usuarioId,
        subtotal: total,
        total,
        totalReales,
        tipoCambio: input.tipoCambio || 0,
        estadoPago,
        montoPagado,
        saldoPendiente,
        metodoPago: input.metodoPago || null,
        fechaVencimiento: input.fechaVencimiento || null,
        comprobante: input.comprobante?.trim() || null,
        origen: input.origen,
        fechaNegocio: new Date(),
        notas: input.notas?.trim() || null,
        detalles: { create: details },
      },
      include: { detalles: true, proveedor: true, sucursal: true, usuario: { select: { id: true, nombre: true } } },
    });
    if (saldoPendiente > 0) {
      await tx.proveedor.update({
        where: { id: input.proveedorId },
        data: { deudaPendiente: { increment: saldoPendiente } },
      });
    }
    if (montoPagado > 0) {
      await tx.pagoCompra.create({
        data: {
          compraId: purchase.id,
          monto: montoPagado,
          metodoPago: input.metodoPago || null,
          usuarioId: input.usuarioId,
          notas: 'Pago registrado junto con la compra',
        },
      });
    }
    return purchase;
  }
}
