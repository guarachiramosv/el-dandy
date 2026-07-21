import { PaymentMethod } from '@prisma/client';
import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { SaleService } from '../services/sale.service';
import { closeCashRegisterSchema, createCashExpenseSchema, createSaleSchema } from '../validators/saleValidator';

const service = new SaleService();

export const updatePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { metodoPago } = req.body;
  
  if (!id || !metodoPago) {
    return res.status(400).json({ success: false, error: 'ID y metodo de pago requeridos' });
  }

  const data = await service.updatePaymentMethod(String(id), metodoPago as PaymentMethod);
  res.json({ success: true, data });
});

export const getAllSales = asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.getAll();
  res.json({ success: true, data });
});

export const createSale = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createSaleSchema.parse(req.body);
  const data = await service.create({
    ...parsed,
    usuarioId: req.user?.id ?? parsed.usuarioId,
    sucursalId: req.user?.role === 'SELLER' && req.user.sucursalId ? req.user.sucursalId : parsed.sucursalId,
  });
  res.status(201).json({ success: true, data });
});

export const getDailySalesSummary = asyncHandler(async (req: Request, res: Response) => {
  const usuarioId = req.user?.id ?? String(req.query.usuarioId || '');
  const sucursalId = req.user?.role === 'SELLER' && req.user.sucursalId
    ? req.user.sucursalId
    : String(req.query.sucursalId || req.user?.sucursalId || '');
  const fecha = typeof req.query.fecha === 'string' ? req.query.fecha : null;

  if (!usuarioId || !sucursalId) {
    return res.status(400).json({ success: false, error: 'Usuario y sucursal requeridos' });
  }

  const data = await service.getDailySummary({ usuarioId, sucursalId, fecha });
  res.json({ success: true, data });
});

export const getPendingCashClosings = asyncHandler(async (req: Request, res: Response) => {
  const usuarioId = req.user?.id || '';
  const sucursalId = req.user?.sucursalId || '';

  if (!usuarioId || !sucursalId) {
    return res.status(400).json({ success: false, error: 'Usuario y sucursal requeridos' });
  }

  const data = await service.getPendingCashClosings({ usuarioId, sucursalId });
  res.json({ success: true, data });
});

export const closeCashRegister = asyncHandler(async (req: Request, res: Response) => {
  const parsed = closeCashRegisterSchema.parse(req.body);
  const usuarioId = req.user?.id ?? String(req.body.usuarioId || '');
  const sucursalId = req.user?.role === 'SELLER' && req.user.sucursalId
    ? req.user.sucursalId
    : String(req.body.sucursalId || req.user?.sucursalId || '');

  if (!usuarioId || !sucursalId) {
    return res.status(400).json({ success: false, error: 'Usuario y sucursal requeridos' });
  }

  const data = await service.closeCashRegister({ ...parsed, usuarioId, sucursalId });
  res.status(201).json({ success: true, data });
});

export const createCashExpense = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createCashExpenseSchema.parse(req.body);
  const usuarioId = req.user?.role === 'SELLER'
    ? req.user.id
    : (parsed.usuarioId || req.user?.id || '');
  const sucursalId = req.user?.role === 'SELLER' && req.user.sucursalId
    ? req.user.sucursalId
    : (parsed.sucursalId || req.user?.sucursalId || '');

  if (!usuarioId || !sucursalId) {
    return res.status(400).json({ success: false, error: 'Usuario y sucursal requeridos' });
  }

  const data = await service.createCashExpense({
    ...parsed,
    usuarioId,
    sucursalId,
  });
  res.status(201).json({ success: true, data });
});
