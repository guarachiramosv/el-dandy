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

const router = Router();

router.get('/', getAllProducts);
router.get('/deletion-history', getProductDeletionHistory);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.patch('/:id/stock', addProductStock);
router.patch('/:id/branches/:sucursalId/status', updateProductBranchStatus);
router.patch('/:id/restore', restoreProduct);
router.patch('/:id/discontinue', discontinueProduct);
router.delete('/:id', deleteProduct);

export default router;
