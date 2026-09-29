import { z } from 'zod';

const uuidLikeSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'ID invalido'
);

const finiteNumber = z.number().refine(Number.isFinite, 'Valor numerico invalido');

const purchaseInfoSchema = z.object({
  proveedorId: uuidLikeSchema,
  precioCompraUnitario: finiteNumber.min(0, 'Precio de compra no puede ser negativo'),
  precioCompraUnitarioReales: finiteNumber.min(0, 'Precio de compra en reales no puede ser negativo').optional().default(0),
  cantidad: finiteNumber.positive('Cantidad debe ser mayor a cero').optional(),
  comprobante: z.string().trim().optional().nullable(),
  notas: z.string().trim().optional().nullable(),
});

export const createProductSchema = z.object({
  codigo: z.string().trim().optional().nullable(),
  codigoRepuesto: z.string().trim().optional().nullable(),
  descripcion: z.string().min(1, 'Descripcion es requerida'),
  descripcionDetallada: z.string().trim().max(3000, 'Descripcion detallada demasiado larga').optional().nullable(),
  marca: z.string().trim().optional().nullable(),
  condicion: z.enum(['NUEVO', 'USADO']).optional(),
  unidadVenta: z.enum(['UNIDAD', 'METRO']).optional(),
  stock: finiteNumber.min(0, 'Stock no puede ser negativo'),
  stockMinimo: finiteNumber.min(0).optional(),
  ubicacion: z.string().trim().optional().nullable(),
  activo: z.boolean().optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'DESCONTINUADO']).optional(),
  precioCompra: finiteNumber.min(0, 'Precio de compra no puede ser negativo'),
  precioCompraReales: finiteNumber.min(0, 'Precio de compra en reales no puede ser negativo').optional(),
  precioVenta: finiteNumber.positive('Precio de venta debe ser positivo'),
  categoriaId: uuidLikeSchema,
  sucursalId: uuidLikeSchema,
  proveedorId: uuidLikeSchema.optional().nullable(),
  imagen: z.string().optional().nullable(),
  deletedImageUrls: z.array(z.string()).optional(),
  compraInicial: purchaseInfoSchema.optional().nullable(),
});

export const updateProductSchema = createProductSchema.partial();

export const addProductStockSchema = z.object({
  sucursalId: uuidLikeSchema,
  cantidad: finiteNumber.min(0, 'Cantidad no puede ser negativa'),
  ubicacion: z.string().trim().optional().nullable(),
  proveedorId: uuidLikeSchema.optional().nullable(),
  precioCompraUnitario: finiteNumber.min(0, 'Precio de compra no puede ser negativo'),
  precioCompraUnitarioReales: finiteNumber.min(0, 'Precio de compra en reales no puede ser negativo').optional().default(0),
  comprobante: z.string().trim().optional().nullable(),
  notas: z.string().trim().optional().nullable(),
}).refine((data) => data.cantidad === 0 || Boolean(data.proveedorId), {
  message: 'Proveedor es requerido para registrar una compra',
  path: ['proveedorId'],
});

export const updateProductBranchStatusSchema = z.object({
  estado: z.enum(['ACTIVO', 'INACTIVO', 'DESCONTINUADO']),
});

export const deleteProductSchema = z.object({
  sucursalId: uuidLikeSchema.optional().nullable(),
  motivo: z.string().trim().min(3, 'El motivo de eliminacion es obligatorio'),
});
