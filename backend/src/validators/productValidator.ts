import { z } from 'zod';

const uuidLikeSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'ID invalido'
);

export const createProductSchema = z.object({
  codigo: z.string().trim().optional().nullable(),
  codigoRepuesto: z.string().trim().optional().nullable(),
  descripcion: z.string().min(1, 'Descripcion es requerida'),
  marca: z.string().trim().optional().nullable(),
  condicion: z.enum(['NUEVO', 'USADO']).optional(),
  unidadVenta: z.enum(['UNIDAD', 'METRO']).optional(),
  stock: z.number().min(0, 'Stock no puede ser negativo'),
  stockMinimo: z.number().min(0).optional(),
  ubicacion: z.string().trim().optional().nullable(),
  activo: z.boolean().optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'DESCONTINUADO']).optional(),
  precioCompra: z.number().positive('Precio de compra debe ser positivo'),
  precioVenta: z.number().positive('Precio de venta debe ser positivo'),
  categoriaId: uuidLikeSchema,
  sucursalId: uuidLikeSchema,
  proveedorId: uuidLikeSchema.optional().nullable(),
  imagen: z.string().optional().nullable(),
  deletedImageUrls: z.array(z.string()).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const addProductStockSchema = z.object({
  sucursalId: uuidLikeSchema,
  cantidad: z.number().positive('Cantidad debe ser mayor a cero'),
  usuarioId: z.string().uuid('ID de usuario invalido').optional().nullable(),
  notas: z.string().trim().optional().nullable(),
});

export const updateProductBranchStatusSchema = z.object({
  estado: z.enum(['ACTIVO', 'INACTIVO', 'DESCONTINUADO']),
});

export const deleteProductSchema = z.object({
  sucursalId: uuidLikeSchema.optional().nullable(),
  motivo: z.string().trim().min(3, 'El motivo de eliminacion es obligatorio'),
});
