import api from './api';
import { Category, Sucursal } from '../types';

export const fetchCategories = async (): Promise<Category[]> => {
  const response = await api.get<{ success: boolean; data: Category[] }>('/categories');
  return response.data.data;
};

export const createCategory = async (nombre: string): Promise<Category> => {
  const response = await api.post<{ success: boolean; data: Category }>('/categories', { nombre });
  return response.data.data;
};

export const updateCategory = async (id: string, nombre: string): Promise<Category> => {
  const response = await api.put<{ success: boolean; data: Category }>(`/categories/${id}`, { nombre });
  return response.data.data;
};

export const deleteCategory = async (id: string): Promise<void> => {
  await api.delete<{ success: boolean; data: null }>(`/categories/${id}`);
};

export const fetchSucursales = async (): Promise<Sucursal[]> => {
  const response = await api.get<{ success: boolean; data: Sucursal[] }>('/sucursales');
  return response.data.data;
};
