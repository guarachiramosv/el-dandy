import { Router } from 'express';
import { createPurchase, getAllPurchases } from '../controllers/purchase.controller';
import { requireAdmin } from '../middlewares/auth';

const router = Router();
router.get('/', getAllPurchases);
router.post('/', requireAdmin, createPurchase);

export default router;
