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
  codigoRepuesto?: string | null;
  descripcion: string;
  marca?: string | null;
  condicion: 'NUEVO' | 'USADO';
  unidadVenta?: 'UNIDAD' | 'METRO';
  stock: number;
  stockMinimo: number;
  activo?: boolean;
  estado?: ProductStatus;
  ubicacion?: string | null;
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
  codigo?: string | null;
  codigoRepuesto?: string | null;
  descripcion: string;
  marca?: string | null;
  condicion: 'NUEVO' | 'USADO';
  unidadVenta?: 'UNIDAD' | 'METRO';
  stock: number;
  stockMinimo: number;
  ubicacion?: string | null;
  precioCompra: number;
  precioVenta: number;
  categoriaId: string;
  sucursalId: string;
  imagen?: string | null;
  deletedImageUrls?: string[];
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

export type RemachadoMedida = {
  id: string;
  medida: string;
  descripcion?: string | null;
  stockJuegos: number;
  stockMinimoJuegos: number;
  precioJuego: number;
  precioMedioJuego: number;
  remachesPorJuego: number;
  remachesPorMedioJuego: number;
  activo: boolean;
  createdAt: string;
};

export type RemachadoRemache = {
  id: string;
  codigo: string;
  nombre: string;
  medida?: string | null;
  stock: number;
  stockMinimo: number;
  activo: boolean;
  createdAt: string;
};

export type RemachadoTrabajo = {
  id: string;
  medidaId: string;
  medida?: RemachadoMedida;
  remacheId?: string | null;
  remache?: RemachadoRemache | null;
  ventaId?: string | null;
  venta?: import('./thermalReceipt').ReceiptSale | null;
  tipoTrabajo: 'JUEGO' | 'MEDIO_JUEGO';
  cantidadJuegos: number;
  cantidadBalatas: number;
  cantidadRemaches: number;
  precioUnitario: number;
  total: number;
  notas?: string | null;
  createdAt: string;
};

export type RemachadoSummary = {
  medidas: RemachadoMedida[];
  remaches: RemachadoRemache[];
  trabajos: RemachadoTrabajo[];
};
