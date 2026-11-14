import { z } from 'zod';
import { Router } from 'express';
import { getCashClosingReport, getMonthlyProfitReport, getProductAuditReport, getProductInventoryReport, getSalesHistoryReport } from '../controllers/report.controller';

const router = Router();
const querySchema = z.object({
  period: z.enum(['day', 'month', 'year', 'all']).optional(),
  value: z.string().max(10).optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  sucursalId: z.string().uuid().optional(),
  usuarioId: z.string().uuid().optional(),
  productoId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
});
router.use((req, _res, next) => {
  querySchema.parse(req.query);
  next();
});

router.get('/cash-closings', getCashClosingReport);
router.get('/product-inventory', getProductInventoryReport);
router.get('/product-audit', getProductAuditReport);
router.get('/sales-history', getSalesHistoryReport);
router.get('/monthly-profit', getMonthlyProfitReport);

export default router;
