// src/validators/userValidator.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['ADMIN', 'SELLER']).optional().default('SELLER'),
  sucursalId: z.string().uuid('ID de sucursal inválido'),
});

export const updateUserSchema = z.object({
  nombre: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'SELLER']).optional(),
  activo: z.boolean().optional(),
  sucursalId: z.string().uuid().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});
