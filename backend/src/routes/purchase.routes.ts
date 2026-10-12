import { Router } from 'express';
import { addPurchasePayment, createPurchase, getAllPurchases } from '../controllers/purchase.controller';
import { requireAdmin } from '../middlewares/auth';

const router = Router();
router.get('/', getAllPurchases);
router.post('/', requireAdmin, createPurchase);
router.post('/:id/payments', requireAdmin, addPurchasePayment);

export default router;
