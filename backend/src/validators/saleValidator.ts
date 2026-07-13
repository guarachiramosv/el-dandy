import { z } from 'zod';

export const createSaleSchema = z.object({
  usuarioId: z.string().uuid('Usuario invalido'),
  sucursalId: z.string().uuid('Sucursal invalida'),
  clienteId: z.string().uuid('Cliente invalido').optional().nullable(),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'QR', 'TARJETA']),
  tipoVenta: z.enum(['CONTADO', 'CREDITO']).default('CONTADO'),
  descuento: z.number().min(0).default(0),
  fechaVencimiento: z.string().optional().nullable(),
  items: z.array(
    z.object({
      productoId: z.string().uuid('Producto invalido'),
      cantidad: z.number().positive('Cantidad debe ser mayor a cero'),
      descuentoItem: z.number().min(0).default(0),
    })
  ).min(1, 'Agrega al menos un producto'),
});

export const closeCashRegisterSchema = z.object({
  fecha: z.string().optional().nullable(),
  montoDeclarado: z.number().min(0, 'Monto declarado invalido'),
  notas: z.string().optional().nullable(),
});

export const createCashExpenseSchema = z.object({
  usuarioId: z.string().uuid('Usuario invalido').optional(),
  sucursalId: z.string().uuid('Sucursal invalida').optional(),
  motivo: z.string().trim().min(2, 'Motivo requerido').max(160, 'Motivo demasiado largo'),
  monto: z.number().positive('Monto debe ser mayor a cero'),
  metodoPago: z.enum(['EFECTIVO', 'QR']),
  notas: z.string().trim().max(300, 'Notas demasiado largas').optional().nullable(),
});
