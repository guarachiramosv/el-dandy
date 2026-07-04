export type User = {
  id: string;
  nombre: string;
  email: string;
  role: 'ADMIN' | 'SELLER';
  sucursalId: string;
};

export type Session = {
  user: User;
  token: string;
};

export type Product = {
  id: string;
  codigo: string;
  descripcion: string;
  marca: string;
  condicion: 'NUEVO' | 'USADO';
  stock: number;
  stockMinimo: number;
  activo?: boolean;
  estado?: ProductStatus;
  precioCompra?: number;
  precioVenta: number;
  imagen?: string | null;
  imagenes?: ProductImage[];
  categoriaId?: string;
  sucursalId: string;
  sucursal?: { id: string; nombre: string; whatsapp?: string | null };
  categoria?: { id: string; nombre: string };
};

export type ProductImage = {
  id: string;
  url: string;
  publicId?: string | null;
  orden: number;
  productoId?: string;
  createdAt?: string;
};

export type ProductStatus = 'ACTIVO' | 'INACTIVO' | 'DESCONTINUADO';

export type ProductStatusFilter = 'active' | 'inactive' | 'discontinued' | 'all';

export type Category = {
  id: string;
  nombre: string;
};

export type Sucursal = {
  id: string;
  nombre: string;
  whatsapp?: string | null;
};

export type ProductInput = {
  codigo: string;
  descripcion: string;
  marca: string;
  condicion: 'NUEVO' | 'USADO';
  stock: number;
  stockMinimo: number;
  precioCompra: number;
  precioVenta: number;
  categoriaId: string;
  sucursalId: string;
  imagen?: string | null;
};

export type StockAlert = {
  id: string;
  tipo: string;
  mensaje: string;
  createdAt: string;
  producto?: Product;
};

export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'QR' | 'TARJETA';

export type Customer = {
  id: string;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  empresa?: string | null;
  ciudad?: string | null;
  nit?: string | null;
  direccion?: string | null;
  notas?: string | null;
  activo: boolean;
  saldoPendiente?: number;
  cantidadCompras?: number;
};

export type CustomerInput = {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  empresa?: string | null;
  ciudad?: string | null;
  nit?: string | null;
  direccion?: string | null;
  notas?: string | null;
};

export type CustomerRegisterInput = {
  nombre: string;
  email: string;
  password: string;
  telefono?: string | null;
  ciudad?: string | null;
  nit?: string | null;
  direccion?: string | null;
};

export type CustomerSession = {
  customer: Customer;
  token: string;
};

export type CustomerSaleDetail = {
  id: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  producto?: Product;
};

export type CustomerSale = {
  id: string;
  subtotal: number;
  descuento: number;
  total: number;
  metodoPago: PaymentMethod;
  tipoVenta: 'CONTADO' | 'CREDITO';
  createdAt: string;
  sucursal?: { id: string; nombre: string };
  detalles?: CustomerSaleDetail[];
  cuenta?: {
    id: string;
    montoTotal: number;
    montoPagado: number;
    saldo: number;
    estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA';
  } | null;
};

export type CartItem = {
  product: Product;
  quantity: number;
};
