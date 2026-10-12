import { Router } from 'express';
import { adjustStock, getMovements, getProductHistory, getStockAlerts, transferStock } from '../controllers/inventory.controller';
import { requireAdmin } from '../middlewares/auth';

const router = Router();
router.get('/movements', getMovements);
router.get('/alerts', getStockAlerts);
router.get('/products/:productoId/history', requireAdmin, getProductHistory);
router.post('/transfers', requireAdmin, transferStock);
router.post('/adjustments', requireAdmin, adjustStock);

export default router;
