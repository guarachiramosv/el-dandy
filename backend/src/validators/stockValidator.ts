import { z } from 'zod';

export const transferStockSchema = z.object({
  productoOrigenId: z.string().uuid('Producto origen invalido'),
  productoDestinoId: z.string().uuid('Producto destino invalido'),
  cantidad: z.number().positive('Cantidad debe ser mayor a cero'),
  usuarioId: z.string().uuid('Usuario invalido'),
  notas: z.string().optional().nullable(),
});

export const adjustStockSchema = z.object({
  productoId: z.string().uuid('Producto invalido'),
  sucursalId: z.string().uuid('Sucursal invalida').optional(),
  cantidad: z.number(),
  usuarioId: z.string().uuid('Usuario invalido'),
  notas: z.string().optional().nullable(),
});
