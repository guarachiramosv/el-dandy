import { prisma } from '../lib/prisma';

export class SucursalService {
  async getAll() {
    return prisma.sucursal.findMany({ orderBy: { nombre: 'asc' } });
  }

  async getById(id: string) {
    return prisma.sucursal.findUnique({ where: { id } });
  }

  async create(data: { nombre: string; whatsapp?: string | null }) {
    return prisma.sucursal.create({ data });
  }

  async update(id: string, data: { nombre?: string; whatsapp?: string | null }) {
    return prisma.sucursal.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.sucursal.delete({ where: { id } });
  }
}
