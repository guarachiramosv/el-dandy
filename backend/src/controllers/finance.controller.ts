import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { FinanceService } from '../services/finance.service';
import { createFinancialMovementSchema, financeMonthSchema, saveMonthlyBalanceSchema } from '../validators/financeValidator';

const service = new FinanceService();

export const getFinanceSummary = asyncHandler(async (req: Request, res: Response) => {
  const month = financeMonthSchema.parse(req.query.month);
  res.json({ success: true, data: await service.getSummary(month) });
});

export const createFinancialMovement = asyncHandler(async (req: Request, res: Response) => {
  const data = createFinancialMovementSchema.parse(req.body);
  res.status(201).json({ success: true, data: await service.createMovement({ ...data, usuarioId: req.user!.id }) });
});

export const deleteFinancialMovement = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.deleteMovement(String(req.params.id)) });
});

export const saveMonthlyBalance = asyncHandler(async (req: Request, res: Response) => {
  const data = saveMonthlyBalanceSchema.parse(req.body);
  res.json({ success: true, data: await service.saveBalance({ ...data, usuarioId: req.user!.id }) });
});
