import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

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

const getJwtSecret = () => process.env.JWT_SECRET || 'dev-secret-change-me';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Sesion requerida' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthUser;
    if (payload.role === 'CUSTOMER') {
      return res.status(403).json({ success: false, error: 'Sesion interna requerida' });
    }
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Sesion invalida o expirada' });
  }
};

export const requireCustomer = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Sesion de cliente requerida' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthUser;
    if (payload.role !== 'CUSTOMER') {
      return res.status(403).json({ success: false, error: 'Cuenta de cliente requerida' });
    }
    req.customer = { id: payload.id, role: 'CUSTOMER' };
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Sesion invalida o expirada' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Permiso de administrador requerido' });
  }
  return next();
};
