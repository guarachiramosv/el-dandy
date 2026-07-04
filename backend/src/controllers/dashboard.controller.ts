// src/controllers/dashboard.controller.ts
import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { asyncHandler } from '../middlewares/asyncHandler';

const service = new DashboardService();

export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.getSummary();
  res.json({ success: true, data });
});
