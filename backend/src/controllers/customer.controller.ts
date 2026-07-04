import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { CustomerService } from '../services/customer.service';
import { createCustomerSchema, createPaymentSchema, updateCustomerSchema } from '../validators/customerValidator';

const service = new CustomerService();

export const getAllCustomers = asyncHandler(async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const activo = req.query.activo === undefined ? undefined : req.query.activo === 'true';
  const data = await service.getAll({ search, activo });
  res.json({ success: true, data });
});

export const getCustomerById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getById(String(req.params.id));
  if (!data) return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
  res.json({ success: true, data });
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createCustomerSchema.parse(req.body);
  const data = await service.create(parsed);
  res.status(201).json({ success: true, data });
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateCustomerSchema.parse(req.body);
  const data = await service.update(String(req.params.id), parsed);
  res.json({ success: true, data });
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  await service.delete(String(req.params.id));
  res.json({ success: true, data: null });
});

export const addCreditPayment = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createPaymentSchema.parse(req.body);
  const data = await service.addPayment(String(req.params.cuentaId), parsed);
  res.status(201).json({ success: true, data });
});
