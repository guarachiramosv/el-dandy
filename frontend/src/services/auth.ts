import api from './api';
import { Customer, CustomerRegisterInput, CustomerSession, User } from '../types';

type LoginResponse = {
  user: User;
  token: string;
};

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await api.post<{ success: boolean; data: LoginResponse }>('/auth/login', {
    email,
    password,
  });
  return response.data.data;
};

export const registerCustomer = async (input: CustomerRegisterInput): Promise<CustomerSession> => {
  const response = await api.post<{ success: boolean; data: CustomerSession }>('/auth/customers/register', input);
  return response.data.data;
};

export const loginCustomer = async (email: string, password: string): Promise<CustomerSession> => {
  const response = await api.post<{ success: boolean; data: CustomerSession }>('/auth/customers/login', {
    email,
    password,
  });
  return response.data.data;
};

export const saveSession = (user: User, token: string) => {
  localStorage.setItem('authToken', token);
  localStorage.setItem('authUser', JSON.stringify(user));
};

export const saveCustomerSession = (customer: Customer, token: string) => {
  localStorage.setItem('customerToken', token);
  localStorage.setItem('authCustomer', JSON.stringify(customer));
};

export const getCustomerToken = () => localStorage.getItem('customerToken');

export const getCurrentCustomer = (): Customer | null => {
  const raw = localStorage.getItem('authCustomer');
  return raw ? JSON.parse(raw) as Customer : null;
};

export const getCurrentUser = (): User | null => {
  const raw = localStorage.getItem('authUser');
  return raw ? JSON.parse(raw) as User : null;
};

export const clearSession = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
};

export const clearCustomerSession = () => {
  localStorage.removeItem('customerToken');
  localStorage.removeItem('authCustomer');
};
