import { z } from 'zod';

export const createSucursalSchema = z.object({
  nombre: z.string().min(2, 'Nombre de sucursal requerido'),
  whatsapp: z.string().optional().nullable(),
});

export const updateSucursalSchema = createSucursalSchema.partial();
