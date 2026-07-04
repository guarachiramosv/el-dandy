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
router.post('/', createSucursal);
router.put('/:id', updateSucursal);
router.delete('/:id', deleteSucursal);

export default router;
