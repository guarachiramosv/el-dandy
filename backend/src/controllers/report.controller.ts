import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { ReportPeriod, ReportService } from '../services/report.service';

const service = new ReportService();

const getPeriod = (value: unknown): ReportPeriod => {
  if (value === 'day' || value === 'month' || value === 'year') return value;
  return 'day';
};

export const getCashClosingReport = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getCashClosingReport({
    period: getPeriod(req.query.period),
    value: typeof req.query.value === 'string' ? req.query.value : null,
    sucursalId: typeof req.query.sucursalId === 'string' ? req.query.sucursalId : null,
    usuarioId: typeof req.query.usuarioId === 'string' ? req.query.usuarioId : null,
  });
  res.json({ success: true, data });
});

export const getSalesHistoryReport = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getSalesHistoryReport({
    period: getPeriod(req.query.period),
    value: typeof req.query.value === 'string' ? req.query.value : null,
    sucursalId: typeof req.query.sucursalId === 'string' ? req.query.sucursalId : null,
  });
  res.json({ success: true, data });
});

export const getProductInventoryReport = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getProductInventoryReport({
    period: getPeriod(req.query.period),
    value: typeof req.query.value === 'string' ? req.query.value : null,
    sucursalId: typeof req.query.sucursalId === 'string' ? req.query.sucursalId : null,
    search: typeof req.query.search === 'string' ? req.query.search : null,
  });
  res.json({ success: true, data });
});
