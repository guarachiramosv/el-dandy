import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { RemachadoService } from '../services/remachado.service';
import {
  adjustRemachadoMedidaStockSchema,
  adjustRemachadoRemacheStockSchema,
  createRemachadoTrabajoSchema,
  upsertRemachadoMedidaSchema,
  upsertRemachadoRemacheSchema,
} from '../validators/remachadoValidator';

const service = new RemachadoService();

export const getRemachadoSummary = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await service.summary() });
});

export const createMedida = asyncHandler(async (req: Request, res: Response) => {
  const parsed = upsertRemachadoMedidaSchema.parse(req.body);
  res.status(201).json({ success: true, data: await service.createMedida(parsed) });
});

export const updateMedida = asyncHandler(async (req: Request, res: Response) => {
  const parsed = upsertRemachadoMedidaSchema.partial().parse(req.body);
  res.json({ success: true, data: await service.updateMedida(String(req.params.id), parsed) });
});

export const adjustMedidaStock = asyncHandler(async (req: Request, res: Response) => {
  const parsed = adjustRemachadoMedidaStockSchema.parse(req.body);
  res.json({
    success: true,
    data: await service.adjustMedidaStock(String(req.params.id), {
      ...parsed,
      usuarioId: parsed.usuarioId || req.user?.id || null,
    }),
  });
});

export const createRemache = asyncHandler(async (req: Request, res: Response) => {
  const parsed = upsertRemachadoRemacheSchema.parse(req.body);
  res.status(201).json({ success: true, data: await service.createRemache(parsed) });
});

export const updateRemache = asyncHandler(async (req: Request, res: Response) => {
  const parsed = upsertRemachadoRemacheSchema.partial().parse(req.body);
  res.json({ success: true, data: await service.updateRemache(String(req.params.id), parsed) });
});

export const adjustRemacheStock = asyncHandler(async (req: Request, res: Response) => {
  const parsed = adjustRemachadoRemacheStockSchema.parse(req.body);
  res.json({
    success: true,
    data: await service.adjustRemacheStock(String(req.params.id), {
      ...parsed,
      usuarioId: parsed.usuarioId || req.user?.id || null,
    }),
  });
});

export const createTrabajo = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createRemachadoTrabajoSchema.parse(req.body);
  const data = await service.createTrabajo({
    ...parsed,
    usuarioId: req.user?.id ?? parsed.usuarioId,
    sucursalId: req.user?.role === 'SELLER' && req.user.sucursalId ? req.user.sucursalId : parsed.sucursalId,
  });
  res.status(201).json({ success: true, data });
});
