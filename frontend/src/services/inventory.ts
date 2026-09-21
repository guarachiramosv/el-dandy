import api from './api';
import { StockAlert, StockMovement } from '../types';

export const fetchStockMovements = async (params?: { productoId?: string; sucursalId?: string; from?: string; to?: string }): Promise<StockMovement[]> => {
  const response = await api.get('/inventory/movements', { params });
  return response.data.data;
};

export type StockAlertFilter = 'todas' | 'stock_bajo' | 'agotado' | 'vendido_stock_bajo';

export const fetchStockAlerts = async (tipo?: StockAlertFilter): Promise<StockAlert[]> => {
  const response = await api.get('/inventory/alerts', { params: tipo ? { tipo } : undefined });
  return response.data.data;
};

export const transferStock = async (data: {
  productoOrigenId: string;
  productoDestinoId: string;
  sucursalOrigenId?: string;
  sucursalDestinoId?: string;
  cantidad: number;
  usuarioId: string;
  notas?: string | null;
}) => {
  const response = await api.post('/inventory/transfers', data);
  return response.data.data;
};

export const adjustStock = async (data: { productoId: string; cantidad: number; usuarioId: string; notas?: string | null }) => {
  const response = await api.post('/inventory/adjustments', data);
  return response.data.data;
};
