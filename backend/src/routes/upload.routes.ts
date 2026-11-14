import { requireAdmin } from '../middlewares/auth';
import { Router } from 'express';
import {
  uploadProductImage,
  uploadProductImageMiddleware,
  uploadProductImages,
  uploadProductImagesMiddleware,
} from '../controllers/upload.controller';

const router = Router();
router.use(requireAdmin);
router.post('/products/:id/image', uploadProductImageMiddleware, uploadProductImage);
router.post('/products/:id/images', uploadProductImagesMiddleware, uploadProductImages);

export default router;
