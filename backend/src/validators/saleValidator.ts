import { z } from 'zod';

export const createSaleSchema = z.object({
  usuarioId: z.string().uuid('Usuario invalido'),
  sucursalId: z.string().uuid('Sucursal invalida'),
  clienteId: z.string().uuid('Cliente invalido').optional().nullable(),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'QR', 'TARJETA', 'MIXTO']),
  pagos: z.array(z.object({
    metodoPago: z.enum(['EFECTIVO', 'QR']),
    monto: z.number().positive('El monto debe ser mayor a cero'),
  })).max(2).optional(),
  tipoVenta: z.enum(['CONTADO', 'CREDITO']).default('CONTADO'),
  descuento: z.number().min(0).default(0),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de vencimiento invalida').optional().nullable(),
  fechaNegocio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de negocio invalida').optional().nullable(),
  cierreCorregidoId: z.string().uuid('Cierre de caja invalido').optional().nullable(),
  motivoCorreccion: z.string().trim().min(5, 'Explica el motivo de la correccion').max(300).optional().nullable(),
  items: z.array(
    z.object({
      productoId: z.string().uuid('Producto invalido'),
      cantidad: z.number().positive('Cantidad debe ser mayor a cero'),
      descuentoItem: z.number().min(0).default(0),
    })
  ).min(1, 'Agrega al menos un producto'),
}).superRefine((data, context) => {
  const productIds = data.items.map((item) => item.productoId);
  if (new Set(productIds).size !== productIds.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'Un producto no puede repetirse en la misma venta' });
  }
  if (data.metodoPago === 'MIXTO') {
    const methods = (data.pagos || []).map((payment) => payment.metodoPago);
    if (methods.length !== 2 || new Set(methods).size !== methods.length) {
      context.addIssue({ code: 'custom', path: ['pagos'], message: 'El pago mixto debe incluir efectivo y QR una sola vez' });
    }
  } else if (data.pagos?.length) {
    context.addIssue({ code: 'custom', path: ['pagos'], message: 'Los pagos detallados solo corresponden al metodo MIXTO' });
  }
});

export const updateSalePaymentMethodSchema = z.object({
  metodoPago: z.enum(['EFECTIVO', 'QR', 'MIXTO']),
  pagos: z.array(z.object({
    metodoPago: z.enum(['EFECTIVO', 'QR']),
    monto: z.number().positive('El monto debe ser mayor a cero'),
  })).max(2).optional(),
}).superRefine((data, context) => {
  if (data.metodoPago === 'MIXTO') {
    const methods = (data.pagos || []).map((payment) => payment.metodoPago);
    if (methods.length !== 2 || new Set(methods).size !== methods.length) {
      context.addIssue({ code: 'custom', path: ['pagos'], message: 'El pago mixto debe incluir efectivo y QR una sola vez' });
    }
  } else if (data.pagos?.length) {
    context.addIssue({ code: 'custom', path: ['pagos'], message: 'Los pagos detallados solo corresponden al metodo MIXTO' });
  }
});

export const closeCashRegisterSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de cierre invalida').optional().nullable(),
  montoDeclarado: z.number().min(0, 'Monto declarado invalido'),
  notas: z.string().optional().nullable(),
  depositadoBanco: z.boolean().optional().default(false),
  montoDepositado: z.number().min(0, 'Monto depositado invalido').optional().nullable(),
  referenciaDeposito: z.string().trim().max(120).optional().nullable(),
}).superRefine((data, context) => {
  if (data.depositadoBanco && (!data.montoDepositado || data.montoDepositado <= 0)) {
    context.addIssue({ code: 'custom', path: ['montoDepositado'], message: 'Indica el monto depositado' });
  }
  if (data.depositadoBanco && data.montoDepositado != null && data.montoDepositado > data.montoDeclarado) {
    context.addIssue({ code: 'custom', path: ['montoDepositado'], message: 'El deposito no puede superar el efectivo declarado' });
  }
});

export const reviewCashClosingSchema = z.object({
  comentario: z.string().trim().min(3, 'El comentario es requerido').max(500),
});

export const createCashExpenseSchema = z.object({
  usuarioId: z.string().uuid('Usuario invalido').optional(),
  sucursalId: z.string().uuid('Sucursal invalida').optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de gasto invalida').optional().nullable(),
  motivo: z.string().trim().min(2, 'Motivo requerido').max(160, 'Motivo demasiado largo'),
  monto: z.number().positive('Monto debe ser mayor a cero'),
  metodoPago: z.enum(['EFECTIVO', 'QR']),
  notas: z.string().trim().max(300, 'Notas demasiado largas').optional().nullable(),
});

export const saleVoidRequestSchema = z.object({
  motivo: z.string().trim().min(2, 'Motivo requerido').max(300, 'Motivo demasiado largo'),
});
