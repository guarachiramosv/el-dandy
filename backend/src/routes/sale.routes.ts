import { Router } from 'express';
import { closeCashRegister, createSale, getAllSales, getDailySalesSummary } from '../controllers/sale.controller';

const router = Router();

router.get('/daily-summary', getDailySalesSummary);
router.post('/close-cash', closeCashRegister);
router.get('/', getAllSales);
router.post('/', createSale);

export default router;
