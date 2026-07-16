import api from './api';
import { CashClosing, CashExpense, DailySalesSummary, Sale, SaleInput } from '../types';

export const createSale = async (sale: SaleInput): Promise<Sale> => {
  const response = await api.post<{ success: boolean; data: Sale }>('/sales', sale);
  return response.data.data;
};

export const fetchDailySalesSummary = async (fecha?: string): Promise<DailySalesSummary> => {
  const response = await api.get<{ success: boolean; data: DailySalesSummary }>('/sales/daily-summary', {
    params: fecha ? { fecha } : undefined,
  });
  return response.data.data;
};

export const closeCashRegister = async (input: { fecha?: string; montoDeclarado: number; notas?: string | null }): Promise<CashClosing> => {
  const response = await api.post<{ success: boolean; data: CashClosing }>('/sales/close-cash', input);
  return response.data.data;
};

export const createCashExpense = async (input: {
  motivo: string;
  monto: number;
  metodoPago: 'EFECTIVO' | 'QR';
  notas?: string | null;
}): Promise<CashExpense> => {
  const response = await api.post<{ success: boolean; data: CashExpense }>('/sales/expenses', input);
  return response.data.data;
};

export const updateSalePaymentMethod = async (id: string, metodoPago: 'EFECTIVO' | 'QR'): Promise<Sale> => {
  const response = await api.patch<{ success: boolean; data: Sale }>(`/sales/${id}/payment-method`, { metodoPago });
  return response.data.data;
};
