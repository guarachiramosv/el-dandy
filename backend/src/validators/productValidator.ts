import { z } from 'zod';

export const createProductSchema = z.object({
  codigo: z.string().min(1, 'Codigo es requerido'),
  descripcion: z.string().min(1, 'Descripcion es requerida'),
  marca: z.string().min(1, 'Marca es requerida'),
  condicion: z.enum(['NUEVO', 'USADO']).optional(),
  stock: z.number().int().min(0, 'Stock no puede ser negativo'),
  stockMinimo: z.number().int().min(0).optional(),
  ubicacion: z.string().trim().optional().nullable(),
  activo: z.boolean().optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'DESCONTINUADO']).optional(),
  precioCompra: z.number().positive('Precio de compra debe ser positivo'),
  precioVenta: z.number().positive('Precio de venta debe ser positivo'),
  categoriaId: z.string().uuid('ID de categoria invalido'),
  sucursalId: z.string().uuid('ID de sucursal invalido'),
  proveedorId: z.string().uuid('ID de proveedor invalido').optional().nullable(),
  imagen: z.string().optional().nullable(),
});

export const updateProductSchema = createProductSchema.partial();

export const addProductStockSchema = z.object({
  sucursalId: z.string().uuid('ID de sucursal invalido'),
  cantidad: z.number().int().positive('Cantidad debe ser mayor a cero'),
  usuarioId: z.string().uuid('ID de usuario invalido').optional().nullable(),
  notas: z.string().trim().optional().nullable(),
});

export const updateProductBranchStatusSchema = z.object({
  estado: z.enum(['ACTIVO', 'INACTIVO', 'DESCONTINUADO']),
});

export const deleteProductSchema = z.object({
  sucursalId: z.string().uuid('ID de sucursal invalido').optional().nullable(),
  motivo: z.string().trim().min(3, 'El motivo de eliminacion es obligatorio'),
});
