// src/services/user.service.ts
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

const SALT_ROUNDS = 10;

export class UserService {
  async getAll() {
    return prisma.usuario.findMany({
      include: { sucursal: true },
      omit: { password: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    return prisma.usuario.findUnique({
      where: { id },
      omit: { password: true },
      include: { sucursal: true },
    });
  }

  async create(data: {
    nombre: string;
    email: string;
    password: string;
    role?: 'ADMIN' | 'SELLER';
    sucursalId: string;
  }) {
    const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);
    return prisma.usuario.create({
      data: { ...data, password: hashed },
      omit: { password: true },
    });
  }

  async update(
    id: string,
    data: {
      nombre?: string;
      email?: string;
      password?: string;
      role?: 'ADMIN' | 'SELLER';
      activo?: boolean;
      sucursalId?: string;
    }
  ) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, SALT_ROUNDS);
    }
    return prisma.usuario.update({
      where: { id },
      data,
      omit: { password: true },
    });
  }

  async toggleActive(id: string) {
    const user = await prisma.usuario.findUnique({ where: { id } });
    if (!user) return null;
    return prisma.usuario.update({
      where: { id },
      data: { activo: !user.activo },
      omit: { password: true },
    });
  }

  async changeOwnPassword(id: string, currentPassword: string, newPassword: string) {
    const user = await prisma.usuario.findUnique({ where: { id } });
    if (!user || !user.activo) return null;
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      throw Object.assign(new Error('Contrasena actual incorrecta'), { status: 400 });
    }
    const password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    return prisma.usuario.update({
      where: { id },
      data: { password },
      omit: { password: true },
    });
  }

  async verifyLogin(email: string, password: string) {
    const user = await prisma.usuario.findFirst({ where: { email } });
    if (!user || !user.activo) return null;
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;
    const { password: _, ...safeUser } = user;
    return safeUser;
  }
}
