import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { StockService } from './stock.service';

const stockService = new StockService();

export class InventoryService {
  async movements(filters: { productoId?: string; sucursalId?: string; from?: Date; to?: Date }) {
    return prisma.movimientoStock.findMany({
      where: {
        productoId: filters.productoId,
        sucursalId: filters.sucursalId,
        createdAt: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
      },
      include: { producto: true, usuario: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  async alerts(sucursalId?: string) {
    return prisma.alertaStock.findMany({
      where: {
        leida: false,
        producto: sucursalId ? { sucursalId } : undefined,
      },
      include: { producto: { include: { sucursal: true, categoria: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async transfer(data: { productoOrigenId: string; productoDestinoId: string; cantidad: number; usuarioId: string; notas?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const origen = await tx.producto.findUnique({ where: { id: data.productoOrigenId } });
      const destino = await tx.producto.findUnique({ where: { id: data.productoDestinoId } });
      if (!origen || !destino) throw Object.assign(new Error('Producto origen o destino no encontrado'), { status: 404 });
      if (origen.id === destino.id) throw Object.assign(new Error('El origen y destino deben ser diferentes'), { status: 400 });
      if (origen.stock < data.cantidad) throw Object.assign(new Error(`Stock insuficiente en origen. Disponible: ${origen.stock}`), { status: 400 });

      const transfer = await tx.transferenciaStock.create({
        data: {
          productoOrigenId: origen.id,
          productoDestinoId: destino.id,
          sucursalOrigenId: origen.sucursalId,
          sucursalDestinoId: destino.sucursalId,
          cantidad: data.cantidad,
          usuarioId: data.usuarioId,
          notas: data.notas,
        },
      });

      await tx.producto.update({ where: { id: origen.id }, data: { stock: origen.stock - data.cantidad } });
      await tx.producto.update({ where: { id: destino.id }, data: { stock: destino.stock + data.cantidad } });

      await stockService.recordMovement(tx, {
        tipoMovimiento: 'TRANSFERENCIA_SALIDA',
        productoId: origen.id,
        sucursalId: origen.sucursalId,
        stockAnterior: origen.stock,
        stockNuevo: origen.stock - data.cantidad,
        cantidad: -data.cantidad,
        usuarioId: data.usuarioId,
        referenciaId: transfer.id,
        referenciaTipo: 'TRANSFERENCIA',
      });
      await stockService.recordMovement(tx, {
        tipoMovimiento: 'TRANSFERENCIA_ENTRADA',
        productoId: destino.id,
        sucursalId: destino.sucursalId,
        stockAnterior: destino.stock,
        stockNuevo: destino.stock + data.cantidad,
        cantidad: data.cantidad,
        usuarioId: data.usuarioId,
        referenciaId: transfer.id,
        referenciaTipo: 'TRANSFERENCIA',
      });

      return transfer;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async adjust(data: { productoId: string; sucursalId?: string; cantidad: number; usuarioId: string; notas?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({
        where: { id: data.productoId },
        include: { stockSucursales: true },
      });
      if (!producto) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
      const sucursalId = data.sucursalId || producto.sucursalId;
      const branchStock = producto.stockSucursales.find((stock) => stock.sucursalId === sucursalId);
      const stockAnterior = branchStock?.stock ?? (producto.sucursalId === sucursalId ? producto.stock : 0);
      const stockNuevo = Math.max(stockAnterior + data.cantidad, 0);
      const appliedDelta = stockNuevo - stockAnterior;
      await tx.productoStockSucursal.upsert({
        where: { productoId_sucursalId: { productoId: producto.id, sucursalId } },
        update: { stock: stockNuevo },
        create: {
          productoId: producto.id,
          sucursalId,
          stock: stockNuevo,
        },
      });
      await tx.producto.update({ where: { id: producto.id }, data: { stock: { increment: appliedDelta } } });
      return stockService.recordMovement(tx, {
        tipoMovimiento: 'AJUSTE',
        productoId: producto.id,
        sucursalId,
        stockAnterior,
        stockNuevo,
        cantidad: appliedDelta,
        usuarioId: data.usuarioId,
        referenciaTipo: 'AJUSTE',
        notas: data.notas,
      });
    });
  }
}
