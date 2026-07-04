import { Router } from 'express';
import { adjustStock, getMovements, getStockAlerts, transferStock } from '../controllers/inventory.controller';

const router = Router();
router.get('/movements', getMovements);
router.get('/alerts', getStockAlerts);
router.post('/transfers', transferStock);
router.post('/adjustments', adjustStock);

export default router;
