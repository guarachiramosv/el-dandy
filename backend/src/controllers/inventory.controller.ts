import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { InventoryService } from '../services/inventory.service';
import { adjustStockSchema, transferStockSchema } from '../validators/stockValidator';

const service = new InventoryService();

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
  res.json({ success: true, data: await service.alerts(sucursalId) });
});

export const transferStock = asyncHandler(async (req: Request, res: Response) => {
  const parsed = transferStockSchema.parse(req.body);
  res.status(201).json({ success: true, data: await service.transfer(parsed) });
});

export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const parsed = adjustStockSchema.parse(req.body);
  res.status(201).json({ success: true, data: await service.adjust(parsed) });
});
