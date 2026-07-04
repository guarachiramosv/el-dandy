import { Router } from 'express';
import { createPurchase, getAllPurchases } from '../controllers/purchase.controller';

const router = Router();
router.get('/', getAllPurchases);
router.post('/', createPurchase);

export default router;
