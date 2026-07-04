import { z } from 'zod';

export const createCategorySchema = z.object({
  nombre: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }).max(100),
});

export const updateCategorySchema = z.object({
  nombre: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }).max(100).optional(),
});
