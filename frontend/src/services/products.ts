// src/services/products.ts
import api from "./api";
import { PaginatedProducts, Product, ProductDeletionHistory } from "../types";

export type ProductStatusFilter = 'active' | 'inactive' | 'discontinued' | 'all';

export const fetchProducts = async (status: ProductStatusFilter = 'active'): Promise<Product[]> => {
  const response = await api.get<{ success: boolean; data: PaginatedProducts }>("/products", {
    params: { limit: 100, status },
  });
  if (!response.data.success) throw new Error("Failed to fetch products");
  return response.data.data.items;
};

export const searchProductsForSale = async (search: string): Promise<Product[]> => {
  const response = await api.get<{ success: boolean; data: PaginatedProducts }>("/products", {
    params: { page: 1, limit: 40, status: 'active', scope: 'all', search },
  });
  if (!response.data.success) throw new Error("Failed to search products");
  return response.data.data.items;
};

export const createProduct = async (product: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> => {
  const response = await api.post<{ success: boolean; data: Product }>("/products", product);
  if (!response.data.success) throw new Error("Failed to create product");
  return response.data.data;
};

export const updateProduct = async (id: string, product: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">> & { deletedImageUrls?: string[] }) : Promise<Product> => {
  const response = await api.put<{ success: boolean; data: Product }>(`/products/${id}`, product);
  if (!response.data.success) throw new Error("Failed to update product");
  return response.data.data;
};

export const addProductStock = async (
  id: string,
  payload: { sucursalId: string; cantidad: number; notas?: string | null },
): Promise<Product> => {
  const response = await api.patch<{ success: boolean; data: Product }>(`/products/${id}/stock`, payload);
  if (!response.data.success) throw new Error("Failed to add product stock");
  return response.data.data;
};

export const updateProductBranchStatus = async (
  id: string,
  sucursalId: string,
  estado: 'ACTIVO' | 'INACTIVO' | 'DESCONTINUADO',
): Promise<Product> => {
  const response = await api.patch<{ success: boolean; data: Product }>(`/products/${id}/branches/${sucursalId}/status`, { estado });
  if (!response.data.success) throw new Error("Failed to update product branch status");
  return response.data.data;
};

export const fetchProductDeletionHistory = async (): Promise<ProductDeletionHistory[]> => {
  const response = await api.get<{ success: boolean; data: ProductDeletionHistory[] }>("/products/deletion-history");
  if (!response.data.success) throw new Error("Failed to fetch product deletion history");
  return response.data.data;
};

export const deleteProduct = async (
  id: string,
  payload: { sucursalId?: string | null; motivo: string },
): Promise<Product> => {
  const response = await api.delete<{ success: boolean; data: Product }>(`/products/${id}`, { data: payload });
  if (!response.data.success) throw new Error("Failed to delete product");
  return response.data.data;
};

export const restoreProduct = async (id: string): Promise<Product> => {
  const response = await api.patch<{ success: boolean; data: Product }>(`/products/${id}/restore`);
  if (!response.data.success) throw new Error("Failed to restore product");
  return response.data.data;
};

export const discontinueProduct = async (id: string): Promise<Product> => {
  const response = await api.patch<{ success: boolean; data: Product }>(`/products/${id}/discontinue`);
  if (!response.data.success) throw new Error("Failed to discontinue product");
  return response.data.data;
};
