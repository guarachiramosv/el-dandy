import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { InventoryAlertType, InventoryService } from '../services/inventory.service';
import { adjustStockSchema, transferStockSchema } from '../validators/stockValidator';
import { ProductHistoryService } from '../services/product-history.service';
import { z } from 'zod';

const service = new InventoryService();
const productHistoryService = new ProductHistoryService();
const alertTypes: InventoryAlertType[] = ['todas', 'stock_bajo', 'agotado', 'vendido_stock_bajo'];

export const getMovements = asyncHandler(async (req: Request, res: Response) => {
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined;
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined;
  res.json({ success: true, data: await service.movements({
    productoId: typeof req.query.productoId === 'string' ? req.query.productoId : undefined,
    sucursalId: typeof req.query.sucursalId === 'string' ? req.query.sucursalId : undefined,
    from,
    to,
  }) });
});

export const getStockAlerts = asyncHandler(async (req: Request, res: Response) => {
  const sucursalId = req.user?.role === 'SELLER' ? req.user.sucursalId : undefined;
  const tipo = typeof req.query.tipo === 'string' && alertTypes.includes(req.query.tipo as InventoryAlertType)
    ? (req.query.tipo as InventoryAlertType)
    : undefined;
  res.json({ success: true, data: await service.alerts({ sucursalId, tipo }) });
});

export const getProductHistory = asyncHandler(async (req: Request, res: Response) => {
  const productoId = z.string().uuid('Producto invalido').parse(req.params.productoId);
  res.json({ success: true, data: await productHistoryService.getByProduct(productoId) });
});

export const transferStock = asyncHandler(async (req: Request, res: Response) => {
  const parsed = transferStockSchema.parse(req.body);
  res.status(201).json({ success: true, data: await service.transfer({ ...parsed, usuarioId: req.user?.id || parsed.usuarioId }) });
});

export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const parsed = adjustStockSchema.parse(req.body);
  res.status(201).json({ success: true, data: await service.adjust({ ...parsed, usuarioId: req.user?.id || parsed.usuarioId }) });
});
