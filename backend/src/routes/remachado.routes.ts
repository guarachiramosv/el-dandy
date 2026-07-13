import { Router } from 'express';
import {
  adjustMedidaStock,
  adjustRemacheStock,
  createMedida,
  createRemache,
  createTrabajo,
  getRemachadoSummary,
  updateMedida,
  updateRemache,
} from '../controllers/remachado.controller';
import { requireAdmin } from '../middlewares/auth';

const router = Router();

router.get('/', getRemachadoSummary);
router.post('/medidas', requireAdmin, createMedida);
router.patch('/medidas/:id', requireAdmin, updateMedida);
router.post('/medidas/:id/stock', requireAdmin, adjustMedidaStock);
router.post('/remaches', requireAdmin, createRemache);
router.patch('/remaches/:id', requireAdmin, updateRemache);
router.post('/remaches/:id/stock', requireAdmin, adjustRemacheStock);
router.post('/trabajos', createTrabajo);

export default router;
