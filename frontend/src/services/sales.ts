import api from './api';
import { CashClosing, CashExpense, DailySalesSummary, PendingCashClosing, Sale, SaleInput, SaleVoidRequest } from '../types';

export const createSale = async (sale: SaleInput): Promise<Sale> => {
  const response = await api.post<{ success: boolean; data: Sale }>('/sales', sale);
  return response.data.data;
};

export const fetchDailySalesSummary = async (fecha?: string, sucursalId?: string): Promise<DailySalesSummary> => {
  const response = await api.get<{ success: boolean; data: DailySalesSummary }>('/sales/daily-summary', {
    params: {
      ...(fecha ? { fecha } : {}),
      ...(sucursalId ? { sucursalId } : {}),
    },
  });
  return response.data.data;
};

export const fetchPendingSaleVoidRequests = async (): Promise<Sale[]> => {
  const response = await api.get<{ success: boolean; data: Sale[] }>('/sales/void-requests/pending');
  return response.data.data;
};

export const fetchPendingCashClosings = async (): Promise<PendingCashClosing[]> => {
  const response = await api.get<{ success: boolean; data: PendingCashClosing[] }>('/sales/pending-cash-closings');
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

export const deleteCashExpense = async (id: string): Promise<void> => {
  const response = await api.delete<{ success: boolean; message: string }>(`/sales/expenses/${id}`);
  if (!response.data.success) {
    throw new Error(response.data.message);
  }
};

export const updateSalePaymentMethod = async (id: string, metodoPago: 'EFECTIVO' | 'QR'): Promise<Sale> => {
  const response = await api.patch<{ success: boolean; data: Sale }>(`/sales/${id}/payment-method`, { metodoPago });
  return response.data.data;
};

export const deleteSale = async (id: string, motivo: string): Promise<void> => {
  const response = await api.delete<{ success: boolean; message: string }>(`/sales/${id}`, { data: { motivo } });
  if (!response.data.success) {
    throw new Error(response.data.message);
  }
};

export const requestSaleVoid = async (id: string, motivo: string): Promise<SaleVoidRequest> => {
  const response = await api.post<{ success: boolean; data: SaleVoidRequest; message: string }>(`/sales/${id}/void-request`, { motivo });
  return response.data.data;
};

export const approveSaleVoidRequest = async (requestId: string): Promise<void> => {
  const response = await api.post<{ success: boolean; message: string }>(`/sales/void-requests/${requestId}/approve`);
  if (!response.data.success) {
    throw new Error(response.data.message);
  }
};
