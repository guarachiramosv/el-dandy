import api from './api';
import { StockAlert, StockMovement } from '../types';

export const fetchStockMovements = async (params?: { productoId?: string; sucursalId?: string; from?: string; to?: string }): Promise<StockMovement[]> => {
  const response = await api.get('/inventory/movements', { params });
  return response.data.data;
};

export const fetchStockAlerts = async (): Promise<StockAlert[]> => {
  const response = await api.get('/inventory/alerts');
  return response.data.data;
};

export const transferStock = async (data: { productoOrigenId: string; productoDestinoId: string; cantidad: number; usuarioId: string; notas?: string | null }) => {
  const response = await api.post('/inventory/transfers', data);
  return response.data.data;
};

export const adjustStock = async (data: { productoId: string; cantidad: number; usuarioId: string; notas?: string | null }) => {
  const response = await api.post('/inventory/adjustments', data);
  return response.data.data;
};
