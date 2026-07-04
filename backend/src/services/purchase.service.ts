import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { StockService } from './stock.service';

const stockService = new StockService();

export class PurchaseService {
  async getAll() {
    return prisma.compra.findMany({
      include: { proveedor: true, sucursal: true, detalles: { include: { producto: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { proveedorId: string; sucursalId: string; usuarioId: string; notas?: string | null; items: { productoId: string; cantidad: number; precioUnitario: number }[] }) {
    return prisma.$transaction(async (tx) => {
      const detallesInput = data.items.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.cantidad * item.precioUnitario,
      }));
      const total = detallesInput.reduce((sum, item) => sum + item.subtotal, 0);

      const compra = await tx.compra.create({
        data: {
          proveedorId: data.proveedorId,
          sucursalId: data.sucursalId,
          usuarioId: data.usuarioId,
          subtotal: total,
          total,
          notas: data.notas,
          detalles: { create: detallesInput },
        },
        include: { detalles: true, proveedor: true, sucursal: true },
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
          data: { stock: { increment: item.cantidad }, precioCompra: item.precioUnitario, proveedorId: data.proveedorId },
        });
        await stockService.recordMovement(tx, {
          tipoMovimiento: 'COMPRA',
          productoId: item.productoId,
          sucursalId: data.sucursalId,
          stockAnterior,
          stockNuevo,
          cantidad: item.cantidad,
          usuarioId: data.usuarioId,
          referenciaId: compra.id,
          referenciaTipo: 'COMPRA',
        });
      }

      return tx.compra.findUnique({
        where: { id: compra.id },
        include: { proveedor: true, sucursal: true, detalles: { include: { producto: true } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
