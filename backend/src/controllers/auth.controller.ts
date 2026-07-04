// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { CustomerService } from '../services/customer.service';
import { ProductService } from '../services/product.service';
import { loginSchema } from '../validators/userValidator';
import { asyncHandler } from '../middlewares/asyncHandler';

const service = new UserService();
const customerService = new CustomerService();
const productService = new ProductService();

const customerRegisterSchema = z.object({
  nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Contrasena debe tener al menos 6 caracteres'),
  telefono: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
  nit: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await service.verifyLogin(email.trim().toLowerCase(), password);
  if (!user) {
    const err: any = new Error('Credenciales incorrectas o usuario inactivo');
    err.status = 401;
    throw err;
  }
  const token = jwt.sign(
    { id: user.id, role: user.role, sucursalId: user.sucursalId },
    process.env.JWT_SECRET || 'dev-secret-change-me',
    { expiresIn: '8h' }
  );
  res.json({ success: true, data: { user, token } });
});

export const registerCustomer = asyncHandler(async (req: Request, res: Response) => {
  const parsed = customerRegisterSchema.parse(req.body);
  const customer = await customerService.register(parsed);
  const token = jwt.sign(
    { id: customer.id, role: 'CUSTOMER' },
    process.env.JWT_SECRET || 'dev-secret-change-me',
    { expiresIn: '8h' }
  );
  res.status(201).json({ success: true, data: { customer, token } });
});

export const loginCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  const customer = await customerService.verifyLogin(email.trim().toLowerCase(), password);
  if (!customer) {
    const err: any = new Error('Credenciales de cliente incorrectas o cuenta inactiva');
    err.status = 401;
    throw err;
  }
  const token = jwt.sign(
    { id: customer.id, role: 'CUSTOMER' },
    process.env.JWT_SECRET || 'dev-secret-change-me',
    { expiresIn: '8h' }
  );
  res.json({ success: true, data: { customer, token } });
});

export const getCustomerProfile = asyncHandler(async (req: Request, res: Response) => {
  const customer = await customerService.getById(String(req.customer?.id));
  if (!customer) return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
  res.json({ success: true, data: customer });
});

export const getCustomerHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await customerService.getPurchaseHistory(String(req.customer?.id));
  res.json({ success: true, data: history });
});

export const getCustomerCatalog = asyncHandler(async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const products = await productService.getCustomerCatalog({ search });
  res.json({ success: true, data: products });
});
