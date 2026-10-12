import { ProductAuditAction, StockMovementType } from '@prisma/client';
import { prisma } from '../lib/prisma';

const auditTitles: Record<ProductAuditAction, string> = {
  CREADO: 'Producto creado',
  EDITADO: 'Datos del producto editados',
  STOCK_AGREGADO: 'Stock agregado',
  STOCK_AJUSTADO: 'Stock ajustado',
  ESTADO_CAMBIADO: 'Estado modificado',
  ELIMINADO: 'Producto eliminado de la sucursal',
  RESTAURADO: 'Producto restaurado',
  DESCONTINUADO: 'Producto descontinuado',
  TRANSFERIDO: 'Stock transferido',
};

const movementTitles: Record<StockMovementType, string> = {
  VENTA: 'Producto vendido',
  COMPRA: 'Compra o ingreso de stock',
  AJUSTE: 'Ajuste de inventario',
  TRANSFERENCIA_SALIDA: 'Transferencia de salida',
  TRANSFERENCIA_ENTRADA: 'Transferencia de entrada',
};

const roundQuantity = (value: number | null) => value == null ? null : Math.round(value * 10000) / 10000;
const closeEnough = (left: number | null, right: number | null) =>
  left != null && right != null && Math.abs(left - right) < 0.0001;

export class ProductHistoryService {
  async getByProduct(productoId: string) {
    const product = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true, codigo: true, descripcion: true },
    });
    if (!product) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });

    const [audits, movements] = await Promise.all([
      prisma.productoAuditoria.findMany({
        where: { productoId },
        include: {
          usuario: { select: { id: true, nombre: true, email: true } },
          sucursal: { select: { id: true, nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.movimientoStock.findMany({
        where: { productoId },
        include: {
          usuario: { select: { id: true, nombre: true, email: true } },
          sucursal: { select: { id: true, nombre: true } },
          proveedor: { select: { id: true, nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const saleIds = movements
      .filter((item) => item.referenciaTipo === 'VENTA' && item.referenciaId)
      .map((item) => item.referenciaId!);
    const purchaseIds = movements
      .filter((item) => item.referenciaTipo === 'COMPRA' && item.referenciaId)
      .map((item) => item.referenciaId!);
    const transferIds = movements
      .filter((item) => item.referenciaTipo === 'TRANSFERENCIA' && item.referenciaId)
      .map((item) => item.referenciaId!);

    const [sales, purchases, transfers] = await Promise.all([
      saleIds.length ? prisma.venta.findMany({
        where: { id: { in: saleIds } },
        select: {
          id: true,
          total: true,
          subtotal: true,
          descuento: true,
          metodoPago: true,
          tipoVenta: true,
          usuario: { select: { id: true, nombre: true, email: true } },
          cliente: { select: { id: true, nombre: true } },
          detalles: {
            where: { productoId },
            select: { cantidad: true, precioUnitario: true, subtotal: true },
          },
        },
      }) : Promise.resolve([]),
      purchaseIds.length ? prisma.compra.findMany({
        where: { id: { in: purchaseIds } },
        select: {
          id: true,
          total: true,
          totalReales: true,
          comprobante: true,
          origen: true,
          estadoPago: true,
          usuario: { select: { id: true, nombre: true, email: true } },
          proveedor: { select: { id: true, nombre: true } },
          detalles: {
            where: { productoId },
            select: { cantidad: true, precioUnitario: true, subtotal: true },
          },
        },
      }) : Promise.resolve([]),
      transferIds.length ? prisma.transferenciaStock.findMany({
        where: { id: { in: transferIds } },
        select: {
          id: true,
          cantidad: true,
          notas: true,
          usuario: { select: { id: true, nombre: true, email: true } },
          sucursalOrigen: { select: { id: true, nombre: true } },
          sucursalDestino: { select: { id: true, nombre: true } },
        },
      }) : Promise.resolve([]),
    ]);

    const salesById = new Map(sales.map((item) => [item.id, item]));
    const purchasesById = new Map(purchases.map((item) => [item.id, item]));
    const transfersById = new Map(transfers.map((item) => [item.id, item]));

    const isRepresentedByMovement = (audit: (typeof audits)[number]) => {
      const expectedTypes: Partial<Record<ProductAuditAction, StockMovementType[]>> = {
        STOCK_AGREGADO: [StockMovementType.COMPRA],
        STOCK_AJUSTADO: [StockMovementType.AJUSTE],
        TRANSFERIDO: [StockMovementType.TRANSFERENCIA_ENTRADA, StockMovementType.TRANSFERENCIA_SALIDA],
      };
      const types = expectedTypes[audit.accion];
      if (!types || audit.cantidad === 0) return false;
      return movements.some((movement) =>
        types.includes(movement.tipoMovimiento)
        && movement.sucursalId === audit.sucursalId
        && movement.usuarioId === audit.usuarioId
        && closeEnough(movement.cantidad, audit.cantidad)
        && Math.abs(movement.createdAt.getTime() - audit.createdAt.getTime()) <= 15000,
      );
    };

    const auditEvents = audits
      .filter((audit) => !isRepresentedByMovement(audit))
      .map((audit) => ({
        id: `AUDITORIA:${audit.id}`,
        source: 'AUDITORIA' as const,
        action: audit.accion,
        title: auditTitles[audit.accion],
        detail: audit.detalle,
        createdAt: audit.createdAt,
        usuario: audit.usuario,
        sucursal: audit.sucursal,
        stockAnterior: roundQuantity(audit.stockAnterior),
        stockNuevo: roundQuantity(audit.stockNuevo),
        cantidad: roundQuantity(audit.cantidad),
        estadoAnterior: audit.estadoAnterior,
        estadoNuevo: audit.estadoNuevo,
        changes: audit.cambios,
        reference: null,
      }));

    const movementEvents = movements.map((movement) => {
      const sale = movement.referenciaId ? salesById.get(movement.referenciaId) : undefined;
      const purchase = movement.referenciaId ? purchasesById.get(movement.referenciaId) : undefined;
      const transfer = movement.referenciaId ? transfersById.get(movement.referenciaId) : undefined;
      const saleLine = sale?.detalles[0];
      const purchaseLine = purchase?.detalles[0];
      const isCancellation = movement.referenciaTipo === 'ANULACION';

      return {
        id: `MOVIMIENTO:${movement.id}`,
        source: 'MOVIMIENTO' as const,
        action: isCancellation ? 'ANULACION' : movement.tipoMovimiento,
        title: isCancellation ? 'Stock devuelto por anulacion de venta' : movementTitles[movement.tipoMovimiento],
        detail: movement.notas,
        createdAt: movement.createdAt,
        usuario: movement.usuario || sale?.usuario || purchase?.usuario || transfer?.usuario || null,
        sucursal: movement.sucursal,
        stockAnterior: roundQuantity(movement.stockAnterior),
        stockNuevo: roundQuantity(movement.stockNuevo),
        cantidad: roundQuantity(movement.cantidad),
        estadoAnterior: null,
        estadoNuevo: null,
        changes: null,
        reference: sale ? {
          type: 'VENTA', id: sale.id, label: `Venta ${sale.id.slice(0, 8)}`,
          metodoPago: sale.metodoPago, tipoVenta: sale.tipoVenta, cliente: sale.cliente?.nombre || null,
          cantidad: saleLine?.cantidad || movement.cantidad, precioUnitario: saleLine?.precioUnitario || null,
          subtotalLinea: saleLine?.subtotal || null, descuentoVenta: sale.descuento, totalVenta: sale.total,
        } : purchase ? {
          type: 'COMPRA', id: purchase.id, label: `Compra ${purchase.id.slice(0, 8)}`,
          proveedor: purchase.proveedor.nombre, comprobante: purchase.comprobante,
          origen: purchase.origen, estadoPago: purchase.estadoPago,
          cantidad: purchaseLine?.cantidad || movement.cantidad, precioUnitario: purchaseLine?.precioUnitario || movement.precioCompraUnitario,
          subtotalLinea: purchaseLine?.subtotal || movement.costoTotal, totalCompra: purchase.total, totalCompraReales: purchase.totalReales,
        } : transfer ? {
          type: 'TRANSFERENCIA', id: transfer.id, label: `Transferencia ${transfer.id.slice(0, 8)}`,
          origen: transfer.sucursalOrigen.nombre, destino: transfer.sucursalDestino.nombre,
          cantidad: transfer.cantidad, notas: transfer.notas,
        } : movement.referenciaId ? {
          type: movement.referenciaTipo || 'REFERENCIA', id: movement.referenciaId,
          label: `${movement.referenciaTipo || 'Referencia'} ${movement.referenciaId.slice(0, 8)}`,
        } : null,
        purchase: movement.tipoMovimiento === StockMovementType.COMPRA ? {
          proveedor: movement.proveedor?.nombre || null,
          precioUnitario: movement.precioCompraUnitario,
          precioUnitarioReales: movement.precioCompraUnitarioReales,
          tipoCambio: movement.tipoCambio,
          costoTotal: movement.costoTotal,
          costoTotalReales: movement.costoTotalReales,
          comprobante: movement.comprobante,
        } : null,
      };
    });

    const items = [...auditEvents, ...movementEvents]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return {
      product,
      total: items.length,
      items,
    };
  }
}
