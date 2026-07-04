import { z } from 'zod';

export const createPurchaseSchema = z.object({
  proveedorId: z.string().uuid('Proveedor invalido'),
  sucursalId: z.string().uuid('Sucursal invalida'),
  usuarioId: z.string().uuid('Usuario invalido'),
  notas: z.string().optional().nullable(),
  items: z.array(z.object({
    productoId: z.string().uuid('Producto invalido'),
    cantidad: z.number().int().positive('Cantidad debe ser mayor a cero'),
    precioUnitario: z.number().positive('Precio debe ser mayor a cero'),
  })).min(1, 'Agrega al menos un producto'),
});
