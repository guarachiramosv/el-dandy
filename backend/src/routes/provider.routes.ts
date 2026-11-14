import { requireAdmin } from '../middlewares/auth';
import { Router } from 'express';
import { createProvider, deleteProvider, getAllProviders, getProviderById, updateProvider } from '../controllers/provider.controller';

const router = Router();
router.get('/', getAllProviders);
router.get('/:id', getProviderById);
router.post('/', requireAdmin, createProvider);
router.put('/:id', requireAdmin, updateProvider);
router.delete('/:id', requireAdmin, deleteProvider);

export default router;
