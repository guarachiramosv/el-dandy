import { StockMovementType } from '@prisma/client';

type Tx = any;

export class StockService {
  async recordMovement(tx: Tx, data: {
    tipoMovimiento: StockMovementType;
    productoId: string;
    sucursalId: string;
    stockAnterior: number;
    stockNuevo: number;
    cantidad: number;
    usuarioId?: string | null;
    referenciaId?: string | null;
    referenciaTipo?: string | null;
    notas?: string | null;
  }) {
    const movement = await tx.movimientoStock.create({ data });
    await this.syncLowStockAlert(tx, data.productoId);
    return movement;
  }

  async syncLowStockAlert(tx: Tx, productoId: string) {
    const producto = await tx.producto.findUnique({ where: { id: productoId } });
    if (!producto) return;
    if (producto.stock <= producto.stockMinimo) {
      const existing = await tx.alertaStock.findFirst({
        where: { productoId, tipo: 'STOCK_BAJO', leida: false },
      });
      if (!existing) {
        await tx.alertaStock.create({
          data: {
            productoId,
            tipo: 'STOCK_BAJO',
            mensaje: `${producto.codigo} - ${producto.descripcion} esta en stock bajo (${producto.stock}/${producto.stockMinimo})`,
          },
        });
      }
    } else {
      await tx.alertaStock.updateMany({
        where: { productoId, tipo: 'STOCK_BAJO', leida: false },
        data: { leida: true },
      });
    }
  }
}
