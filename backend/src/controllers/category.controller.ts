// src/controllers/category.controller.ts
import { Request, Response } from 'express';
import { CategoryService } from '../services/category.service';
import { createCategorySchema, updateCategorySchema } from '../validators/categoryValidator';
import { asyncHandler } from '../middlewares/asyncHandler';

const service = new CategoryService();

export const getAllCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.getAll();
  res.json({ success: true, data });
});

export const getCategoryById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const cat = await service.getById(id);
  if (!cat) return res.status(404).json({ success: false, error: 'Categoría no encontrada' });
  res.json({ success: true, data: cat });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { nombre } = createCategorySchema.parse(req.body);
  const data = await service.create(nombre);
  res.status(201).json({ success: true, data });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { nombre } = updateCategorySchema.parse(req.body);
  const data = await service.update(id, nombre!);
  res.json({ success: true, data });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await service.delete(id);
  res.json({ success: true, data: null });
});
