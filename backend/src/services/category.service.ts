// src/services/category.service.ts
import { prisma } from '../lib/prisma';

export class CategoryService {
  async getAll() {
    return prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
  }

  async getById(id: string) {
    return prisma.categoria.findUnique({ where: { id } });
  }

  async create(nombre: string) {
    return prisma.categoria.create({ data: { nombre } });
  }

  async update(id: string, nombre: string) {
    return prisma.categoria.update({ where: { id }, data: { nombre } });
  }

  async delete(id: string) {
    return prisma.categoria.delete({ where: { id } });
  }
}
