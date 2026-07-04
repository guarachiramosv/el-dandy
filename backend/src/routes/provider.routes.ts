import { Router } from 'express';
import { createProvider, deleteProvider, getAllProviders, getProviderById, updateProvider } from '../controllers/provider.controller';

const router = Router();
router.get('/', getAllProviders);
router.get('/:id', getProviderById);
router.post('/', createProvider);
router.put('/:id', updateProvider);
router.delete('/:id', deleteProvider);

export default router;
