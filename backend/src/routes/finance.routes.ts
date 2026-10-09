import { Router } from 'express';
import { createFinancialMovement, deleteFinancialMovement, getFinanceSummary, saveMonthlyBalance } from '../controllers/finance.controller';

const router = Router();

router.get('/summary', getFinanceSummary);
router.post('/movements', createFinancialMovement);
router.delete('/movements/:id', deleteFinancialMovement);
router.put('/balance', saveMonthlyBalance);

export default router;
