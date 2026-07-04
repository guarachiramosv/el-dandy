import { z } from 'zod';

export const createProviderSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  contacto: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email('Email invalido').optional().nullable().or(z.literal('')),
  pais: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
  deudaPendiente: z.number().min(0).optional(),
  activo: z.boolean().optional(),
});

export const updateProviderSchema = createProviderSchema.partial();
