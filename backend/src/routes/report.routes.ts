import { Router } from 'express';
import { getCashClosingReport, getProductInventoryReport, getSalesHistoryReport } from '../controllers/report.controller';

const router = Router();

router.get('/cash-closings', getCashClosingReport);
router.get('/product-inventory', getProductInventoryReport);
router.get('/sales-history', getSalesHistoryReport);

export default router;
