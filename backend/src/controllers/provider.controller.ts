import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { ProviderService } from '../services/provider.service';
import { createProviderSchema, updateProviderSchema } from '../validators/providerValidator';

const service = new ProviderService();

export const getAllProviders = asyncHandler(async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  res.json({ success: true, data: await service.getAll(search) });
});

export const getProviderById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getById(String(req.params.id));
  if (!data) return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
  res.json({ success: true, data });
});

export const createProvider = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createProviderSchema.parse(req.body);
  res.status(201).json({ success: true, data: await service.create(parsed) });
});

export const updateProvider = asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateProviderSchema.parse(req.body);
  res.json({ success: true, data: await service.update(String(req.params.id), parsed) });
});

export const deleteProvider = asyncHandler(async (req: Request, res: Response) => {
  await service.delete(String(req.params.id));
  res.json({ success: true, data: null });
});
