import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class ProviderService {
  async getAll(search?: string) {
    const where: Prisma.ProveedorWhereInput = search ? {
      OR: [
        { nombre: { contains: search, mode: 'insensitive' } },
        { contacto: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { pais: { contains: search, mode: 'insensitive' } },
      ],
    } : {};
    return prisma.proveedor.findMany({
      where,
      include: { compras: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    return prisma.proveedor.findUnique({
      where: { id },
      include: { compras: { include: { detalles: { include: { producto: true } } }, orderBy: { createdAt: 'desc' } } },
    });
  }

  async create(data: any) {
    return prisma.proveedor.create({ data: { ...data, email: data.email || null } });
  }

  async update(id: string, data: any) {
    return prisma.proveedor.update({ where: { id }, data: { ...data, email: data.email || null } });
  }

  async delete(id: string) {
    return prisma.proveedor.update({ where: { id }, data: { activo: false } });
  }
}
