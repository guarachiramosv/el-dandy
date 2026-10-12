import api from './api';
import { Purchase } from '../types';

export type PurchaseInput = {
  proveedorId: string;
  sucursalId: string;
  usuarioId: string;
  notas?: string | null;
  metodoPago?: 'EFECTIVO' | 'TRANSFERENCIA' | 'QR' | 'TARJETA' | null;
  montoPagado?: number;
  fechaVencimiento?: string | null;
  comprobante?: string | null;
  tipoCambio?: number;
  items: { productoId: string; cantidad: number; precioUnitario: number; precioUnitarioReales?: number }[];
};

export const addPurchasePayment = async (
  id: string,
  input: { monto: number; metodoPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'QR' | 'TARJETA'; notas?: string | null },
): Promise<Purchase> => {
  const response = await api.post(`/purchases/${id}/payments`, input);
  return response.data.data;
};

export const fetchPurchases = async (): Promise<Purchase[]> => {
  const response = await api.get('/purchases');
  return response.data.data;
};

export const createPurchase = async (purchase: PurchaseInput): Promise<Purchase> => {
  const response = await api.post('/purchases', purchase);
  return response.data.data;
};
