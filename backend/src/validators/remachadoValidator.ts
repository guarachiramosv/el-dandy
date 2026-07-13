import { z } from 'zod';

const uuidSchema = z.string().uuid('ID invalido');

export const upsertRemachadoMedidaSchema = z.object({
  medida: z.string().trim().min(1, 'Medida requerida').max(80),
  descripcion: z.string().trim().max(200).optional().nullable(),
  stockJuegos: z.number().min(0).optional(),
  stockMinimoJuegos: z.number().min(0).optional(),
  precioJuego: z.number().positive('Precio por juego requerido'),
  precioMedioJuego: z.number().positive('Precio por medio juego requerido'),
  remachesPorJuego: z.number().int().min(0).optional(),
  remachesPorMedioJuego: z.number().int().min(0).optional(),
  activo: z.boolean().optional(),
});

export const adjustRemachadoMedidaStockSchema = z.object({
  cantidadJuegos: z.number().refine((value) => value !== 0, 'Cantidad no puede ser cero'),
  usuarioId: uuidSchema.optional().nullable(),
  notas: z.string().trim().max(300).optional().nullable(),
});

export const upsertRemachadoRemacheSchema = z.object({
  codigo: z.string().trim().min(1, 'Codigo requerido').max(40),
  nombre: z.string().trim().min(1, 'Nombre requerido').max(120),
  medida: z.string().trim().max(80).optional().nullable(),
  stock: z.number().int().min(0).optional(),
  stockMinimo: z.number().int().min(0).optional(),
  activo: z.boolean().optional(),
});

export const adjustRemachadoRemacheStockSchema = z.object({
  cantidad: z.number().int().refine((value) => value !== 0, 'Cantidad no puede ser cero'),
  usuarioId: uuidSchema.optional().nullable(),
  notas: z.string().trim().max(300).optional().nullable(),
});

export const createRemachadoTrabajoSchema = z.object({
  medidaId: uuidSchema,
  remacheId: uuidSchema.optional().nullable(),
  usuarioId: uuidSchema,
  sucursalId: uuidSchema,
  clienteId: uuidSchema.optional().nullable(),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'QR', 'TARJETA']).default('EFECTIVO'),
  tipoVenta: z.enum(['CONTADO', 'CREDITO']).default('CONTADO'),
  fechaVencimiento: z.string().optional().nullable(),
  tipoTrabajo: z.enum(['JUEGO', 'MEDIO_JUEGO']),
  cantidadRemaches: z.number().int().min(0).optional(),
  resorteProductoId: uuidSchema.optional().nullable(),
  cantidadResortes: z.number().int().min(0).optional(),
  gomaProductoId: uuidSchema.optional().nullable(),
  cantidadGomas: z.number().int().min(0).optional(),
  seguroProductoId: uuidSchema.optional().nullable(),
  cantidadSeguros: z.number().int().min(0).optional(),
  accesorios: z.array(z.object({
    productoId: uuidSchema,
    cantidad: z.number().positive('Cantidad debe ser mayor a cero'),
    precioUnitario: z.number().min(0).default(0),
  })).optional(),
  notas: z.string().trim().max(300).optional().nullable(),
});
