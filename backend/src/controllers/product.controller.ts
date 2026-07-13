// src/controllers/product.controller.ts
import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { addProductStockSchema, createProductSchema, deleteProductSchema, updateProductBranchStatusSchema, updateProductSchema } from '../validators/productValidator';
import { asyncHandler } from '../middlewares/asyncHandler';

const service = new ProductService();

export const getAllProducts = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, status, scope } = req.query as any;
  const result = await service.getAll({
    page: Number(page),
    limit: Number(limit),
    search: search as string,
    status: status === 'inactive' || status === 'discontinued' || status === 'all' ? status : 'active',
    sucursalId: scope === 'branch' ? req.user?.sucursalId : undefined,
  });
  res.json({ success: true, data: result });
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const product = await service.getById(id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Producto no encontrado' });
  }
  res.json({ success: true, data: product });
});

export const getProductDeletionHistory = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await service.deletionHistory() });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createProductSchema.parse(req.body);
  const product = await service.create(parsed as any);
  res.status(201).json({ success: true, data: product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = updateProductSchema.parse(req.body);
  const product = await service.update(id, parsed as any);
  res.json({ success: true, data: product });
});

export const addProductStock = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = addProductStockSchema.parse(req.body);
  const product = await service.addStock(id, {
    ...parsed,
    usuarioId: parsed.usuarioId || req.user?.id || null,
  });
  res.json({ success: true, data: product });
});

export const updateProductBranchStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const sucursalId = String(req.params.sucursalId);
  const parsed = updateProductBranchStatusSchema.parse(req.body);
  const product = await service.updateBranchStatus(id, sucursalId, parsed.estado);
  res.json({ success: true, data: product });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = deleteProductSchema.parse(req.body);
  const product = await service.delete(id, { ...parsed, usuarioId: req.user?.id || null });
  res.json({ success: true, data: product });
});

export const restoreProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const product = await service.restore(id);
  res.json({ success: true, data: product });
});

export const discontinueProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const product = await service.discontinue(id);
  res.json({ success: true, data: product });
});
