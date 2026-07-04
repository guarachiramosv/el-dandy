import api from './api';
import { Product } from '../types';

const customerAuthHeaders = () => {
  const token = localStorage.getItem('customerToken');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export const fetchCustomerCatalog = async (search = ''): Promise<Product[]> => {
  const response = await api.get<{ success: boolean; data: Product[] }>('/auth/customers/catalog', {
    headers: customerAuthHeaders(),
    params: search ? { search } : undefined,
  });
  return response.data.data;
};
