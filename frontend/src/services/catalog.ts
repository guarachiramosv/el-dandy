import api from './api';
import { Category, Sucursal } from '../types';

export const fetchCategories = async (): Promise<Category[]> => {
  const response = await api.get<{ success: boolean; data: Category[] }>('/categories');
  return response.data.data;
};

export const fetchSucursales = async (): Promise<Sucursal[]> => {
  const response = await api.get<{ success: boolean; data: Sucursal[] }>('/sucursales');
  return response.data.data;
};
