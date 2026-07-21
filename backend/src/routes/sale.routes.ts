import { Router } from 'express';
import { closeCashRegister, createCashExpense, createSale, getAllSales, getDailySalesSummary, getPendingCashClosings, updatePaymentMethod } from '../controllers/sale.controller';

const router = Router();

router.get('/daily-summary', getDailySalesSummary);
router.get('/pending-cash-closings', getPendingCashClosings);
router.post('/expenses', createCashExpense);
router.post('/close-cash', closeCashRegister);
router.get('/', getAllSales);
router.post('/', createSale);
router.patch('/:id/payment-method', updatePaymentMethod);

export default router;
