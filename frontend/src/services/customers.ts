import api from './api';
import { Customer, PaymentMethod } from '../types';

export type CustomerInput = {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  empresa?: string | null;
  ciudad?: string | null;
  nit?: string | null;
  direccion?: string | null;
  notas?: string | null;
  activo?: boolean;
};

export const fetchCustomers = async (search = ''): Promise<Customer[]> => {
  const response = await api.get<{ success: boolean; data: Customer[] }>('/customers', {
    params: search ? { search } : undefined,
  });
  return response.data.data;
};

export const fetchCustomerById = async (id: string): Promise<Customer> => {
  const response = await api.get<{ success: boolean; data: Customer }>(`/customers/${id}`);
  return response.data.data;
};

export const createCustomer = async (customer: CustomerInput): Promise<Customer> => {
  const response = await api.post<{ success: boolean; data: Customer }>('/customers', customer);
  return response.data.data;
};

export const updateCustomer = async (id: string, customer: Partial<CustomerInput>): Promise<Customer> => {
  const response = await api.put<{ success: boolean; data: Customer }>(`/customers/${id}`, customer);
  return response.data.data;
};

export const deleteCustomer = async (id: string): Promise<void> => {
  await api.delete(`/customers/${id}`);
};

export const addCreditPayment = async (
  cuentaId: string,
  payment: { monto: number; metodoPago: PaymentMethod; usuarioId: string; notas?: string | null }
) => {
  const response = await api.post(`/customers/credits/${cuentaId}/payments`, payment);
  return response.data.data;
};
