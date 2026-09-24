import { Router } from 'express';
import { approveSaleVoidRequest, closeCashRegister, createCashExpense, createSale, deleteCashExpense, deleteSale, getAllSales, getDailySalesSummary, getPendingCashClosings, requestSaleVoid, updatePaymentMethod } from '../controllers/sale.controller';
import { requireAdmin } from '../middlewares/auth';

const router = Router();

router.get('/daily-summary', getDailySalesSummary);
router.get('/pending-cash-closings', getPendingCashClosings);
router.post('/expenses', createCashExpense);
router.delete('/expenses/:id', deleteCashExpense);
router.post('/close-cash', closeCashRegister);
router.post('/void-requests/:requestId/approve', requireAdmin, approveSaleVoidRequest);
router.get('/', getAllSales);
router.post('/', createSale);
router.post('/:id/void-request', requestSaleVoid);
router.delete('/:id', requireAdmin, deleteSale);
router.patch('/:id/payment-method', requireAdmin, updatePaymentMethod);

export default router;
