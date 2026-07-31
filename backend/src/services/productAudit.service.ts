import { Prisma, ProductAuditAction, ProductStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

type Tx = any;

type ProductAuditInput = {
  accion: ProductAuditAction;
  productoId?: string | null;
  codigo?: string | null;
  descripcion?: string | null;
  sucursalId?: string | null;
  usuarioId?: string | null;
  stockAnterior?: number | null;
  stockNuevo?: number | null;
  cantidad?: number | null;
  estadoAnterior?: ProductStatus | null;
  estadoNuevo?: ProductStatus | null;
  detalle?: string | null;
  cambios?: Prisma.InputJsonValue | null;
};

export class ProductAuditService {
  async record(tx: Tx, data: ProductAuditInput) {
    return tx.productoAuditoria.create({
      data: {
        accion: data.accion,
        productoId: data.productoId || null,
        codigo: data.codigo || null,
        descripcion: data.descripcion || null,
        sucursalId: data.sucursalId || null,
        usuarioId: data.usuarioId || null,
        stockAnterior: data.stockAnterior ?? null,
        stockNuevo: data.stockNuevo ?? null,
        cantidad: data.cantidad ?? null,
        estadoAnterior: data.estadoAnterior ?? null,
        estadoNuevo: data.estadoNuevo ?? null,
        detalle: data.detalle || null,
        cambios: data.cambios === undefined || data.cambios === null ? Prisma.DbNull : data.cambios,
      },
    });
  }

  async list(params: {
    from: Date;
    to: Date;
    sucursalId?: string | null;
    usuarioId?: string | null;
    productoId?: string | null;
  }) {
    const where: Prisma.ProductoAuditoriaWhereInput = {
      createdAt: { gte: params.from, lt: params.to },
    };
    if (params.sucursalId) where.sucursalId = params.sucursalId;
    if (params.usuarioId) where.usuarioId = params.usuarioId;
    if (params.productoId) where.productoId = params.productoId;

    return prisma.productoAuditoria.findMany({
      where,
      include: {
        producto: {
          select: {
            id: true,
            codigo: true,
            codigoRepuesto: true,
            descripcion: true,
            marca: true,
            ubicacion: true,
          },
        },
        sucursal: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
