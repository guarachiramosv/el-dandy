import { z } from 'zod';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

export const financeMonthSchema = z.string().regex(monthPattern, 'Mes invalido');

export const createFinancialMovementSchema = z.object({
  categoria: z.enum(['GASTO_NEGOCIO', 'RETIRO_PERSONAL', 'APORTE_PROPIETARIO']),
  descripcion: z.string().trim().min(3, 'Describe el movimiento').max(160, 'Descripcion demasiado larga'),
  monto: z.number().positive('El monto debe ser mayor a cero'),
  fecha: z.string().regex(datePattern, 'Fecha invalida'),
  sucursalId: z.string().uuid('Sucursal invalida').optional().nullable(),
  notas: z.string().trim().max(500, 'Notas demasiado largas').optional().nullable(),
});

export const saveMonthlyBalanceSchema = z.object({
  mes: financeMonthSchema,
  saldoInicial: z.number().min(0, 'El saldo inicial no puede ser negativo'),
  saldoReal: z.number().min(0, 'El saldo real no puede ser negativo').optional().nullable(),
});
