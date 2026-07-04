import { z } from 'zod';

export const createCustomerSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  telefono: z.string().optional().nullable(),
  email: z.string().email('Email invalido').optional().nullable().or(z.literal('')),
  empresa: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
  nit: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
  activo: z.boolean().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const createPaymentSchema = z.object({
  monto: z.number().positive('Monto debe ser mayor a cero'),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'QR', 'TARJETA']),
  usuarioId: z.string().uuid('Usuario invalido'),
  notas: z.string().optional().nullable(),
});
