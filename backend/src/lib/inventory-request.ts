import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import type { Request, NextFunction } from 'express';

type InventoryRequest = { usuarioId: string; clave: string; hash: string };
export const inventoryRequest = new AsyncLocalStorage<InventoryRequest>();

export function withInventoryRequest(req: Request, next: NextFunction) {
  const clave = req.get('Idempotency-Key');
  if (!/^\/api\/(products|sales|inventory|purchases|remachado)(\/|$)/.test(req.originalUrl)) return next();
  if (!clave || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(clave)) {
    return next(Object.assign(new Error('Identificador de operacion invalido'), { status: 400 }));
  }
  const hash = createHash('sha256').update(JSON.stringify({ method: req.method, path: req.originalUrl, body: req.body })).digest('hex');
  return inventoryRequest.run({ usuarioId: req.user!.id, clave, hash }, next);
}
