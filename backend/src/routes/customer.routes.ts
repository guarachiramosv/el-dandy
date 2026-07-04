import { Router } from 'express';
import {
  addCreditPayment,
  createCustomer,
  deleteCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
} from '../controllers/customer.controller';

const router = Router();

router.get('/', getAllCustomers);
router.post('/credits/:cuentaId/payments', addCreditPayment);
router.get('/:id', getCustomerById);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
