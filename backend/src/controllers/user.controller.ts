// src/controllers/user.controller.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { createUserSchema, updateUserSchema } from '../validators/userValidator';
import { asyncHandler } from '../middlewares/asyncHandler';

const service = new UserService();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contrasena actual requerida'),
  newPassword: z.string().min(6, 'Nueva contrasena debe tener al menos 6 caracteres'),
});

export const getAllUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await service.getAll();
  res.json({ success: true, data: users });
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const user = await service.getById(id);
  if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
  res.json({ success: true, data: user });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const data = createUserSchema.parse(req.body);
  const user = await service.create(data);
  res.status(201).json({ success: true, data: user });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const data = updateUserSchema.parse(req.body);
  const user = await service.update(id, data);
  res.json({ success: true, data: user });
});

export const toggleUserActive = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const user = await service.toggleActive(id);
  if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
  res.json({ success: true, data: user });
});

export const changeOwnPassword = asyncHandler(async (req: Request, res: Response) => {
  const parsed = changePasswordSchema.parse(req.body);
  if (!req.user?.id) return res.status(401).json({ success: false, error: 'Sesion requerida' });
  const user = await service.changeOwnPassword(req.user.id, parsed.currentPassword, parsed.newPassword);
  if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado o inactivo' });
  res.json({ success: true, data: user });
});
