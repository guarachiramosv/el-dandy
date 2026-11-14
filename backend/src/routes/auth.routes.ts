// src/routes/auth.routes.ts
import { Router } from 'express';
import {
  getCustomerCatalog,
  getCustomerHistory,
  getCustomerProfile,
  login,
  loginCustomer,
  registerCustomer,
} from '../controllers/auth.controller';
import { changeOwnPassword } from '../controllers/user.controller';
import { requireAuth, requireCustomer } from '../middlewares/auth';
import { authRateLimit, registrationRateLimit } from '../middlewares/authRateLimit';

const router = Router();

router.post('/login', authRateLimit, login);
router.post('/customers/register', registrationRateLimit, registerCustomer);
router.post('/customers/login', authRateLimit, loginCustomer);
router.patch('/change-password', requireAuth, changeOwnPassword);
router.get('/customers/me', requireCustomer, getCustomerProfile);
router.get('/customers/catalog', requireCustomer, getCustomerCatalog);
router.get('/customers/history', requireCustomer, getCustomerHistory);

export default router;
