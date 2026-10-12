import { z } from 'zod';

export const createPurchaseSchema = z.object({
  proveedorId: z.string().uuid('Proveedor invalido'),
  sucursalId: z.string().uuid('Sucursal invalida'),
  usuarioId: z.string().uuid('Usuario invalido').optional(),
  notas: z.string().optional().nullable(),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'QR', 'TARJETA']).optional().nullable(),
  montoPagado: z.number().min(0, 'Monto pagado invalido').optional(),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de vencimiento invalida').optional().nullable(),
  comprobante: z.string().trim().max(160).optional().nullable(),
  tipoCambio: z.number().min(0).optional(),
  items: z.array(z.object({
    productoId: z.string().uuid('Producto invalido'),
    cantidad: z.number().positive('Cantidad debe ser mayor a cero'),
    precioUnitario: z.number().positive('Precio debe ser mayor a cero'),
    precioUnitarioReales: z.number().min(0).optional(),
  })).min(1, 'Agrega al menos un producto'),
}).superRefine((data, context) => {
  const productIds = data.items.map((item) => item.productoId);
  if (new Set(productIds).size !== productIds.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'Un producto no puede repetirse en la misma compra' });
  }
  if (data.montoPagado !== 0 && !data.metodoPago) {
    context.addIssue({ code: 'custom', path: ['metodoPago'], message: 'Indica el metodo del pago realizado' });
  }
  if (data.items.some((item) => (item.precioUnitarioReales || 0) > 0) && (!data.tipoCambio || data.tipoCambio <= 0)) {
    context.addIssue({ code: 'custom', path: ['tipoCambio'], message: 'Indica el tipo de cambio para precios en reales' });
  }
});

export const createPurchasePaymentSchema = z.object({
  monto: z.number().positive('El monto debe ser mayor a cero'),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'QR', 'TARJETA']),
  notas: z.string().trim().max(300).optional().nullable(),
});
