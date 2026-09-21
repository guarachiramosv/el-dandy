import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { StockService } from './stock.service';
import { ProductAuditService } from './productAudit.service';

const stockService = new StockService();
const productAuditService = new ProductAuditService();
const SOLD_LOW_STOCK_DAYS = 30;

export type InventoryAlertType = 'todas' | 'stock_bajo' | 'agotado' | 'vendido_stock_bajo';

type InventoryAlertFilters = {
  sucursalId?: string;
  tipo?: InventoryAlertType;
};

export class InventoryService {
  private async syncProductTotalStock(tx: any, productoId: string) {
    const result = await tx.productoStockSucursal.aggregate({
      where: { productoId, estado: 'ACTIVO', activo: true },
      _sum: { stock: true },
    });
    const stock = result._sum.stock ?? 0;
    const activeBranches = await tx.productoStockSucursal.count({
      where: { productoId, estado: 'ACTIVO', activo: true },
    });
    await tx.producto.update({
      where: { id: productoId },
      data: { stock, activo: activeBranches > 0, estado: activeBranches > 0 ? 'ACTIVO' : 'INACTIVO' },
    });
    return stock;
  }

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

  async alerts(filters: InventoryAlertFilters = {}) {
    const tipo = filters.tipo || 'todas';
    const includeProduct = { sucursal: true, categoria: true };
    const productWhere = {
      estado: 'ACTIVO' as const,
      activo: true,
      sucursalId: filters.sucursalId,
    };

    const [lowStockProducts, soldProducts] = await Promise.all([
      tipo === 'todas' || tipo === 'stock_bajo' || tipo === 'agotado'
        ? prisma.producto.findMany({
            where: productWhere,
            include: includeProduct,
            orderBy: [{ stock: 'asc' }, { descripcion: 'asc' }],
          })
        : Promise.resolve([]),
      tipo === 'todas' || tipo === 'vendido_stock_bajo'
        ? this.soldLowStockProducts(filters.sucursalId)
        : Promise.resolve([]),
    ]);

    const now = new Date();
    const lowStockAlerts = lowStockProducts
      .filter((producto) => producto.stock <= producto.stockMinimo)
      .filter((producto) => {
        if (tipo === 'agotado') return producto.stock <= 0;
        if (tipo === 'stock_bajo') return producto.stock > 0;
        return true;
      })
      .map((producto) => {
        const agotado = producto.stock <= 0;
        return {
          id: `${agotado ? 'agotado' : 'stock-bajo'}-${producto.id}`,
          productoId: producto.id,
          producto,
          tipo: agotado ? 'AGOTADO' : 'STOCK_BAJO',
          mensaje: agotado
            ? 'Producto agotado. Reponer antes de seguir vendiendo.'
            : `Stock bajo: quedan ${producto.stock} de minimo ${producto.stockMinimo}.`,
          leida: false,
          createdAt: now,
        };
      });

    const soldLowStockAlerts = soldProducts.map(({ producto, vendidosUltimos30Dias }) => ({
      id: `vendido-stock-bajo-${producto.id}`,
      productoId: producto.id,
      producto,
      tipo: 'VENDIDO_STOCK_BAJO',
      mensaje: `Vendido recientemente (${vendidosUltimos30Dias} uds en ${SOLD_LOW_STOCK_DAYS} dias) y con poco stock.`,
      leida: false,
      createdAt: now,
      vendidosUltimos30Dias,
    }));

    return [...soldLowStockAlerts, ...lowStockAlerts];
  }

  private async soldLowStockProducts(sucursalId?: string) {
    const since = new Date();
    since.setDate(since.getDate() - SOLD_LOW_STOCK_DAYS);

    const soldGroups = await prisma.detalleVenta.groupBy({
      by: ['productoId'],
      where: {
        productoId: { not: null },
        venta: {
          createdAt: { gte: since },
          sucursalId,
        },
      },
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 100,
    });

    const productIds = soldGroups.map((item) => item.productoId).filter((id): id is string => Boolean(id));
    if (productIds.length === 0) return [];

    const products = await prisma.producto.findMany({
      where: {
        id: { in: productIds },
        estado: 'ACTIVO',
        activo: true,
        sucursalId,
      },
      include: { sucursal: true, categoria: true },
    });

    const productsById = new Map(products.map((producto) => [producto.id, producto]));
    return soldGroups
      .map((item) => {
        const producto = item.productoId ? productsById.get(item.productoId) : undefined;
        if (!producto || producto.stock > producto.stockMinimo) return null;
        return {
          producto,
          vendidosUltimos30Dias: item._sum.cantidad ?? 0,
        };
      })
      .filter((item): item is { producto: NonNullable<(typeof products)[number]>; vendidosUltimos30Dias: number } => Boolean(item));
  }

  async transfer(data: {
    productoOrigenId: string;
    productoDestinoId: string;
    sucursalOrigenId?: string;
    sucursalDestinoId?: string;
    cantidad: number;
    usuarioId: string;
    notas?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const origen = await tx.producto.findUnique({ where: { id: data.productoOrigenId }, include: { stockSucursales: true } });
      const destino = await tx.producto.findUnique({ where: { id: data.productoDestinoId }, include: { stockSucursales: true } });
      if (!origen || !destino) throw Object.assign(new Error('Producto origen o destino no encontrado'), { status: 404 });
      if (origen.codigo.trim().toLowerCase() !== destino.codigo.trim().toLowerCase()) {
        throw Object.assign(new Error('Solo puedes transferir stock entre productos con el mismo codigo'), { status: 400 });
      }

      const sucursalOrigenId = data.sucursalOrigenId || origen.sucursalId;
      const sucursalDestinoId = data.sucursalDestinoId || destino.sucursalId;
      if (sucursalOrigenId === sucursalDestinoId) throw Object.assign(new Error('La sucursal origen y destino deben ser diferentes'), { status: 400 });

      const origenBranch = origen.stockSucursales.find((branch) => branch.sucursalId === sucursalOrigenId);
      const destinoBranch = destino.stockSucursales.find((branch) => branch.sucursalId === sucursalDestinoId);
      if (!origenBranch) throw Object.assign(new Error('El producto no tiene stock registrado en la sucursal origen'), { status: 404 });
      if (!destinoBranch) throw Object.assign(new Error('El producto no esta preparado en la sucursal destino. Agregalo con stock 0 antes de transferir.'), { status: 404 });
      if (origenBranch.estado !== 'ACTIVO' || !origenBranch.activo) {
        throw Object.assign(new Error('El producto no esta activo en la sucursal origen'), { status: 400 });
      }
      if (destinoBranch.estado !== 'ACTIVO' || !destinoBranch.activo) {
        throw Object.assign(new Error('El producto no esta activo en la sucursal destino'), { status: 400 });
      }
      if (origenBranch.stock < data.cantidad) {
        throw Object.assign(new Error(`Stock insuficiente en origen. Disponible: ${origenBranch.stock}`), { status: 400 });
      }

      const stockOrigenNuevo = origenBranch.stock - data.cantidad;
      const stockDestinoNuevo = destinoBranch.stock + data.cantidad;

      const transfer = await tx.transferenciaStock.create({
        data: {
          productoOrigenId: origen.id,
          productoDestinoId: destino.id,
          sucursalOrigenId,
          sucursalDestinoId,
          cantidad: data.cantidad,
          usuarioId: data.usuarioId,
          notas: data.notas,
        },
      });

      await tx.productoStockSucursal.update({
        where: { productoId_sucursalId: { productoId: origen.id, sucursalId: sucursalOrigenId } },
        data: { stock: stockOrigenNuevo },
      });
      await tx.productoStockSucursal.update({
        where: { productoId_sucursalId: { productoId: destino.id, sucursalId: sucursalDestinoId } },
        data: { stock: stockDestinoNuevo },
      });
      await this.syncProductTotalStock(tx, origen.id);
      if (destino.id !== origen.id) await this.syncProductTotalStock(tx, destino.id);

      await stockService.recordMovement(tx, {
        tipoMovimiento: 'TRANSFERENCIA_SALIDA',
        productoId: origen.id,
        sucursalId: sucursalOrigenId,
        stockAnterior: origenBranch.stock,
        stockNuevo: stockOrigenNuevo,
        cantidad: -data.cantidad,
        usuarioId: data.usuarioId,
        referenciaId: transfer.id,
        referenciaTipo: 'TRANSFERENCIA',
      });
      await productAuditService.record(tx, {
        accion: 'TRANSFERIDO',
        productoId: origen.id,
        codigo: origen.codigo,
        descripcion: origen.descripcion,
        sucursalId: sucursalOrigenId,
        usuarioId: data.usuarioId,
        stockAnterior: origenBranch.stock,
        stockNuevo: stockOrigenNuevo,
        cantidad: -data.cantidad,
        detalle: `Transferencia de salida hacia sucursal ${sucursalDestinoId}`,
      });
      await stockService.recordMovement(tx, {
        tipoMovimiento: 'TRANSFERENCIA_ENTRADA',
        productoId: destino.id,
        sucursalId: sucursalDestinoId,
        stockAnterior: destinoBranch.stock,
        stockNuevo: stockDestinoNuevo,
        cantidad: data.cantidad,
        usuarioId: data.usuarioId,
        referenciaId: transfer.id,
        referenciaTipo: 'TRANSFERENCIA',
      });
      await productAuditService.record(tx, {
        accion: 'TRANSFERIDO',
        productoId: destino.id,
        codigo: destino.codigo,
        descripcion: destino.descripcion,
        sucursalId: sucursalDestinoId,
        usuarioId: data.usuarioId,
        stockAnterior: destinoBranch.stock,
        stockNuevo: stockDestinoNuevo,
        cantidad: data.cantidad,
        detalle: `Transferencia de entrada desde sucursal ${sucursalOrigenId}`,
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
      const movement = await stockService.recordMovement(tx, {
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
      await productAuditService.record(tx, {
        accion: 'STOCK_AJUSTADO',
        productoId: producto.id,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        sucursalId,
        usuarioId: data.usuarioId,
        stockAnterior,
        stockNuevo,
        cantidad: appliedDelta,
        detalle: data.notas || 'Ajuste manual de inventario',
      });
      return movement;
    });
  }
}
