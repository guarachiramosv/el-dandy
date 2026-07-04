import api from './api';
import { Purchase } from '../types';

export type PurchaseInput = {
  proveedorId: string;
  sucursalId: string;
  usuarioId: string;
  notas?: string | null;
  items: { productoId: string; cantidad: number; precioUnitario: number }[];
};

export const fetchPurchases = async (): Promise<Purchase[]> => {
  const response = await api.get('/purchases');
  return response.data.data;
};

export const createPurchase = async (purchase: PurchaseInput): Promise<Purchase> => {
  const response = await api.post('/purchases', purchase);
  return response.data.data;
};
