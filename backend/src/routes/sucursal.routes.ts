import { requireAdmin } from '../middlewares/auth';
import { Router } from 'express';
import {
  createSucursal,
  deleteSucursal,
  getAllSucursales,
  getSucursalById,
  updateSucursal,
} from '../controllers/sucursal.controller';

const router = Router();

router.get('/', getAllSucursales);
router.get('/:id', getSucursalById);
router.post('/', requireAdmin, createSucursal);
router.put('/:id', requireAdmin, updateSucursal);
router.delete('/:id', requireAdmin, deleteSucursal);

export default router;
