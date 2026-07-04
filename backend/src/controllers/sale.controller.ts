import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { SaleService } from '../services/sale.service';
import { closeCashRegisterSchema, createSaleSchema } from '../validators/saleValidator';

const service = new SaleService();

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
