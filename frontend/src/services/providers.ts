import api from './api';
import { Provider } from '../types';

export type ProviderInput = {
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  pais?: string | null;
  direccion?: string | null;
  notas?: string | null;
  deudaPendiente?: number;
  activo?: boolean;
};

export const fetchProviders = async (search = ''): Promise<Provider[]> => {
  const response = await api.get('/providers', { params: search ? { search } : undefined });
  return response.data.data;
};

export const createProvider = async (provider: ProviderInput): Promise<Provider> => {
  const response = await api.post('/providers', provider);
  return response.data.data;
};

export const updateProvider = async (id: string, provider: Partial<ProviderInput>): Promise<Provider> => {
  const response = await api.put(`/providers/${id}`, provider);
  return response.data.data;
};

export const deleteProvider = async (id: string): Promise<void> => {
  await api.delete(`/providers/${id}`);
};
