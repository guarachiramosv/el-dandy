import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { PurchaseService } from '../services/purchase.service';
import { createPurchaseSchema } from '../validators/purchaseValidator';

const service = new PurchaseService();

export const getAllPurchases = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await service.getAll() });
});

export const createPurchase = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createPurchaseSchema.parse(req.body);
  res.status(201).json({ success: true, data: await service.create(parsed) });
});
