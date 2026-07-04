// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  console.error(err);
  // Custom error status
  const status = err.status || 500;

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: err.issues.map((e) => e.message).join(', '),
    });
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target : [];
    let message = 'Ya existe un registro con esos datos.';
    if (target.includes('codigo') && target.includes('sucursalId')) {
      message = 'Ya existe ese codigo en la sucursal seleccionada. Puedes usar el mismo codigo en otra sucursal.';
    } else if (target.includes('codigo')) {
      message = 'Ya existe un producto con ese codigo.';
    } else if (target.length > 0) {
      message = `Ya existe un registro con el mismo valor en: ${target.join(', ')}.`;
    }
    return res.status(409).json({
      success: false,
      error: message,
    });
  }

  // Generic fallback
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
};
