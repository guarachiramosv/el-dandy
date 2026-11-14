import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { getJwtSecret } from '../lib/jwt-secret';

export type AuthUser = {
  id: string;
  role: 'ADMIN' | 'SELLER' | 'CUSTOMER';
  sucursalId?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      customer?: { id: string; role: 'CUSTOMER' };
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Sesion requerida' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.id !== 'string' || !['ADMIN', 'SELLER'].includes(payload.role)) {
      return res.status(403).json({ success: false, error: 'Sesion interna requerida' });
    }
    const user = await prisma.usuario.findUnique({
      where: { id: payload.id },
      select: { id: true, role: true, sucursalId: true, activo: true },
    });
    if (!user?.activo) return res.status(401).json({ success: false, error: 'Sesion invalida o usuario inactivo' });
    req.user = { id: user.id, role: user.role, sucursalId: user.sucursalId };
    return next();
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError)) return next(error);
    return res.status(401).json({ success: false, error: 'Sesion invalida o expirada' });
  }
};

export const requireCustomer = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Sesion de cliente requerida' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.id !== 'string' || payload.role !== 'CUSTOMER') {
      return res.status(403).json({ success: false, error: 'Cuenta de cliente requerida' });
    }
    const customer = await prisma.cliente.findUnique({ where: { id: payload.id }, select: { id: true, activo: true } });
    if (!customer?.activo) return res.status(401).json({ success: false, error: 'Cuenta de cliente inactiva' });
    req.customer = { id: customer.id, role: 'CUSTOMER' };
    return next();
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError)) return next(error);
    return res.status(401).json({ success: false, error: 'Sesion invalida o expirada' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Permiso de administrador requerido' });
  }
  return next();
};
