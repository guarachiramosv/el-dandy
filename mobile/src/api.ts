import {
  Category,
  Customer,
  CustomerInput,
  CustomerSale,
  CustomerRegisterInput,
  CustomerSession,
  PaymentMethod,
  Product,
  ProductInput,
  ProductStatusFilter,
  RemachadoMedida,
  RemachadoSummary,
  RemachadoTrabajo,
  Session,
  StockAlert,
  Sucursal,
} from './types';
import type { ReceiptSale } from './thermalReceipt';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://sistema-el-dandy.onrender.com/api').replace(/\/$/, '');

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
};

export type ProductImageUpload = {
  uri: string;
  name?: string | null;
  type?: string | null;
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !body?.success) {
    throw new Error(body?.error || `Error de conexión (${response.status})`);
  }
  return body.data;
}

export function login(email: string, password: string) {
  return request<Session>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
}

export function registerCustomer(input: CustomerRegisterInput) {
  return request<CustomerSession>('/auth/customers/register', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      email: input.email.trim().toLowerCase(),
    }),
  });
}

export function loginCustomer(email: string, password: string) {
  return request<CustomerSession>('/auth/customers/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
}

export function getCustomerCatalog(token: string, search = '') {
  const params = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return request<Product[]>(`/auth/customers/catalog${params}`, {}, token);
}

export function getCustomerHistory(token: string) {
  return request<CustomerSale[]>('/auth/customers/history', {}, token);
}

export function getCustomerProfile(token: string) {
  return request<Customer>('/auth/customers/me', {}, token);
}

export async function getProducts(token: string, search = ''): Promise<Product[]> {
  const params = new URLSearchParams({ limit: '100', status: 'active' });
  if (search.trim()) params.set('search', search.trim());
  const result = await request<{ items: Product[] }>(`/products?${params}`, {}, token);
  return result.items;
}

export async function getAdminProducts(
  token: string,
  search = '',
  status: ProductStatusFilter = 'active',
): Promise<Product[]> {
  const params = new URLSearchParams({ limit: '100', status });
  if (search.trim()) params.set('search', search.trim());
  const result = await request<{ items: Product[] }>(`/products?${params}`, {}, token);
  return result.items;
}

export function getCategories(token: string) {
  return request<Category[]>('/categories', {}, token);
}

export function getSucursales(token: string) {
  return request<Sucursal[]>('/sucursales', {}, token);
}

export function createProduct(token: string, input: ProductInput) {
  return request<Product>(
    '/products',
    { method: 'POST', body: JSON.stringify(input) },
    token,
  );
}

export function updateProduct(token: string, id: string, input: Partial<ProductInput>) {
  return request<Product>(
    `/products/${id}`,
    { method: 'PUT', body: JSON.stringify(input) },
    token,
  );
}

export function deleteProduct(
  token: string,
  id: string,
  payload: { sucursalId?: string | null; motivo: string },
) {
  return request<Product>(
    `/products/${id}`,
    { method: 'DELETE', body: JSON.stringify(payload) },
    token,
  );
}

export function restoreProduct(token: string, id: string) {
  return request<Product>(`/products/${id}/restore`, { method: 'PATCH' }, token);
}

export function discontinueProduct(token: string, id: string) {
  return request<Product>(`/products/${id}/discontinue`, { method: 'PATCH' }, token);
}

export async function uploadProductImage(token: string, productId: string, image: ProductImageUpload) {
  const form = new FormData();
  const fileName = image.name || `producto-${productId}.jpg`;
  form.append('image', {
    uri: image.uri,
    name: fileName,
    type: image.type || 'image/jpeg',
  } as unknown as Blob);

  const response = await fetch(`${API_URL}/upload/products/${productId}/image`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const body = (await response.json().catch(() => null)) as ApiEnvelope<{
    imageUrl: string;
    product: Product;
    publicId: string;
  }> | null;
  if (!response.ok || !body?.success) {
    throw new Error(body?.error || `Error al subir imagen (${response.status})`);
  }
  return body.data;
}

export async function uploadProductImages(token: string, productId: string, images: ProductImageUpload[]) {
  const form = new FormData();
  images.forEach((image, index) => {
    const fileName = image.name || `producto-${productId}-${index + 1}.jpg`;
    form.append('images', {
      uri: image.uri,
      name: fileName,
      type: image.type || 'image/jpeg',
    } as unknown as Blob);
  });

  const response = await fetch(`${API_URL}/upload/products/${productId}/images`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const body = (await response.json().catch(() => null)) as ApiEnvelope<{
    imageUrls: string[];
    images: Array<{ imageUrl: string; publicId: string }>;
    product: Product;
  }> | null;
  if (!response.ok || !body?.success) {
    throw new Error(body?.error || `Error al subir imagenes (${response.status})`);
  }
  return body.data;
}

export function getAlerts(token: string) {
  return request<StockAlert[]>('/inventory/alerts', {}, token);
}

export function getCustomers(token: string, search = '') {
  const params = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return request<Customer[]>(`/customers${params}`, {}, token);
}

export function createCustomer(token: string, input: CustomerInput) {
  return request<Customer>(
    '/customers',
    { method: 'POST', body: JSON.stringify(input) },
    token,
  );
}

export function createSale(
  session: Session,
  input: {
    clienteId?: string | null;
    metodoPago: PaymentMethod;
    descuento: number;
    items: Array<{ productoId: string; cantidad: number; descuentoItem: number }>;
  },
) {
  return request<ReceiptSale>(
    '/sales',
    {
      method: 'POST',
      body: JSON.stringify({
        usuarioId: session.user.id,
        sucursalId: session.user.sucursalId,
        clienteId: input.clienteId || null,
        tipoVenta: 'CONTADO',
        ...input,
      }),
    },
    session.token,
  );
}

export function getRemachadoSummary(token: string) {
  return request<RemachadoSummary>('/remachado', {}, token);
}

export function createRemachadoMedida(
  token: string,
  input: {
    medida: string;
    descripcion?: string | null;
    stockJuegos?: number;
    stockMinimoJuegos?: number;
    precioJuego: number;
    precioMedioJuego: number;
    remachesPorJuego?: number;
    remachesPorMedioJuego?: number;
  },
) {
  return request<RemachadoMedida>(
    '/remachado/medidas',
    { method: 'POST', body: JSON.stringify(input) },
    token,
  );
}

export function createRemachadoTrabajo(
  session: Session,
  input: {
    medidaId: string;
    remacheId?: string | null;
    metodoPago: PaymentMethod;
    tipoTrabajo: 'JUEGO' | 'MEDIO_JUEGO';
    accesorios?: Array<{ productoId: string; cantidad: number; precioUnitario?: number }>;
    notas?: string | null;
  },
) {
  return request<RemachadoTrabajo>(
    '/remachado/trabajos',
    {
      method: 'POST',
      body: JSON.stringify({
        usuarioId: session.user.id,
        sucursalId: session.user.sucursalId,
        tipoVenta: 'CONTADO',
        ...input,
      }),
    },
    session.token,
  );
}

export { API_URL };
