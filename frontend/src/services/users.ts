import api from './api';
import { User } from '../types';

export type UserInput = {
  nombre: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'SELLER';
  sucursalId: string;
  activo?: boolean;
};

export const fetchUsers = async (): Promise<User[]> => {
  const response = await api.get<{ success: boolean; data: User[] }>('/users');
  return response.data.data;
};

export const createUser = async (input: Required<Pick<UserInput, 'nombre' | 'email' | 'password' | 'role' | 'sucursalId'>>): Promise<User> => {
  const response = await api.post<{ success: boolean; data: User }>('/users', input);
  return response.data.data;
};

export const updateUser = async (id: string, input: Partial<UserInput>): Promise<User> => {
  const response = await api.put<{ success: boolean; data: User }>(`/users/${id}`, input);
  return response.data.data;
};

export const toggleUserActive = async (id: string): Promise<User> => {
  const response = await api.patch<{ success: boolean; data: User }>(`/users/${id}/toggle`);
  return response.data.data;
};

export const changeOwnPassword = async (input: { currentPassword: string; newPassword: string }): Promise<User> => {
  const response = await api.patch<{ success: boolean; data: User }>('/auth/change-password', input);
  return response.data.data;
};
