// src/routes/product.routes.ts
import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  getProductDeletionHistory,
  createProduct,
  updateProduct,
  addProductStock,
  updateProductBranchStatus,
  deleteProduct,
  restoreProduct,
  discontinueProduct,
} from '../controllers/product.controller';
import { requireAdmin } from '../middlewares/auth';

const router = Router();

router.get('/', getAllProducts);
router.get('/deletion-history', getProductDeletionHistory);
router.get('/:id', getProductById);
router.post('/', requireAdmin, createProduct);
router.put('/:id', requireAdmin, updateProduct);
router.patch('/:id/stock', requireAdmin, addProductStock);
router.patch('/:id/branches/:sucursalId/status', requireAdmin, updateProductBranchStatus);
router.patch('/:id/restore', requireAdmin, restoreProduct);
router.patch('/:id/discontinue', requireAdmin, discontinueProduct);
router.delete('/:id', requireAdmin, deleteProduct);

export default router;
