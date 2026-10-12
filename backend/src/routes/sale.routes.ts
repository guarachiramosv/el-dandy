import { Router } from 'express';
import { approveCashClosing, approveSaleVoidRequest, closeCashRegister, createCashExpense, createSale, deleteCashExpense, deleteSale, getAllSales, getCashClosingsForReview, getDailySalesSummary, getPendingCashClosings, getPendingSaleVoidRequests, observeCashClosing, requestSaleVoid, updatePaymentMethod } from '../controllers/sale.controller';
import { requireAdmin } from '../middlewares/auth';

const router = Router();

router.get('/daily-summary', getDailySalesSummary);
router.get('/pending-cash-closings', getPendingCashClosings);
router.post('/expenses', createCashExpense);
router.delete('/expenses/:id', deleteCashExpense);
router.post('/close-cash', closeCashRegister);
router.get('/cash-closings/review', requireAdmin, getCashClosingsForReview);
router.post('/cash-closings/:id/approve', requireAdmin, approveCashClosing);
router.post('/cash-closings/:id/observe', requireAdmin, observeCashClosing);
router.get('/void-requests/pending', requireAdmin, getPendingSaleVoidRequests);
router.post('/void-requests/:requestId/approve', requireAdmin, approveSaleVoidRequest);
router.get('/', getAllSales);
router.post('/', createSale);
router.post('/:id/void-request', requestSaleVoid);
router.delete('/:id', requireAdmin, deleteSale);
router.patch('/:id/payment-method', updatePaymentMethod);

export default router;
