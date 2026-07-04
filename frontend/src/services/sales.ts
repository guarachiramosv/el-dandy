import api from './api';
import { CashClosing, DailySalesSummary, Sale, SaleInput } from '../types';

export const createSale = async (sale: SaleInput): Promise<Sale> => {
  const response = await api.post<{ success: boolean; data: Sale }>('/sales', sale);
  return response.data.data;
};

export const fetchDailySalesSummary = async (): Promise<DailySalesSummary> => {
  const response = await api.get<{ success: boolean; data: DailySalesSummary }>('/sales/daily-summary');
  return response.data.data;
};

export const closeCashRegister = async (input: { montoDeclarado: number; notas?: string | null }): Promise<CashClosing> => {
  const response = await api.post<{ success: boolean; data: CashClosing }>('/sales/close-cash', input);
  return response.data.data;
};
