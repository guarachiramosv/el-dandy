import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { SucursalService } from '../services/sucursal.service';
import { createSucursalSchema, updateSucursalSchema } from '../validators/sucursalValidator';

const service = new SucursalService();

export const getAllSucursales = asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.getAll();
  res.json({ success: true, data });
});

export const getSucursalById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const data = await service.getById(id);
  if (!data) return res.status(404).json({ success: false, error: 'Sucursal no encontrada' });
  res.json({ success: true, data });
});

export const createSucursal = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createSucursalSchema.parse(req.body);
  const data = await service.create(parsed);
  res.status(201).json({ success: true, data });
});

export const updateSucursal = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = updateSucursalSchema.parse(req.body);
  if (Object.keys(parsed).length === 0) return res.status(400).json({ success: false, error: 'No hay cambios para guardar' });
  const data = await service.update(id, parsed);
  res.json({ success: true, data });
});

export const deleteSucursal = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await service.delete(id);
  res.json({ success: true, data: null });
});
