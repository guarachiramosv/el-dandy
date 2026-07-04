export interface Category {
  id: string;
  nombre: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Sucursal {
  id: string;
  nombre: string;
  whatsapp?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  codigo: string;
  descripcion: string;
  marca: string;
  condicion: string;
  stock: number;
  stockMinimo?: number;
  ubicacion?: string | null;
  activo?: boolean;
  estado?: 'ACTIVO' | 'INACTIVO' | 'DESCONTINUADO';
  precioCompra: number;
  precioVenta: number;
  imagen?: string;
  imagenes?: ProductImage[];
  proveedorId?: string | null;
  proveedor?: Provider | null;
  categoriaId: string;
  categoria?: Category;
  sucursalId: string;
  sucursal?: Sucursal;
  stockSucursales?: ProductBranchStock[];
  createdAt: string;
  updatedAt?: string;
}

export interface ProductBranchStock {
  id: string;
  productoId: string;
  sucursalId: string;
  sucursal?: Sucursal;
  stock: number;
  activo?: boolean;
  estado?: 'ACTIVO' | 'INACTIVO' | 'DESCONTINUADO';
  createdAt?: string;
}

export interface ProductDeletionHistory {
  id: string;
  productoId: string;
  producto?: Pick<Product, 'id' | 'codigo' | 'descripcion' | 'marca' | 'ubicacion'>;
  sucursalId?: string | null;
  sucursal?: Pick<Sucursal, 'id' | 'nombre'> | null;
  usuarioId?: string | null;
  usuario?: Pick<User, 'id' | 'nombre' | 'email'> | null;
  motivo: string;
  stockAnterior: number;
  estadoAnterior: 'ACTIVO' | 'INACTIVO' | 'DESCONTINUADO';
  createdAt: string;
}

export interface ProductImage {
  id: string;
  url: string;
  publicId?: string | null;
  orden: number;
  productoId?: string;
  createdAt?: string;
}

export interface Provider {
  id: string;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  pais?: string | null;
  direccion?: string | null;
  notas?: string | null;
  deudaPendiente: number;
  activo: boolean;
  createdAt: string;
  compras?: Purchase[];
}

export interface Purchase {
  id: string;
  proveedorId: string;
  proveedor?: Provider;
  sucursalId: string;
  sucursal?: Sucursal;
  usuarioId: string;
  subtotal: number;
  total: number;
  estado: 'BORRADOR' | 'RECIBIDA' | 'ANULADA';
  notas?: string | null;
  detalles?: PurchaseDetail[];
  createdAt: string;
}

export interface PurchaseDetail {
  id: string;
  compraId: string;
  productoId: string;
  producto?: Product;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface StockMovement {
  id: string;
  tipoMovimiento: 'VENTA' | 'COMPRA' | 'AJUSTE' | 'TRANSFERENCIA_SALIDA' | 'TRANSFERENCIA_ENTRADA';
  productoId: string;
  producto?: Product;
  sucursalId: string;
  stockAnterior: number;
  stockNuevo: number;
  cantidad: number;
  usuarioId?: string | null;
  referenciaId?: string | null;
  referenciaTipo?: string | null;
  notas?: string | null;
  createdAt: string;
}

export interface StockAlert {
  id: string;
  productoId: string;
  producto?: Product;
  tipo: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
}

export interface CreditPayment {
  id: string;
  cuentaId: string;
  monto: number;
  metodoPago: PaymentMethod;
  usuarioId: string;
  notas?: string | null;
  createdAt: string;
}

export interface CreditAccount {
  id: string;
  clienteId: string;
  ventaId: string;
  sucursalId: string;
  montoTotal: number;
  montoPagado: number;
  saldo: number;
  fechaVencimiento?: string | null;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'VENCIDA';
  notas?: string | null;
  pagos?: CreditPayment[];
  createdAt: string;
}

export interface Customer {
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
  createdAt: string;
  ventas?: Sale[];
  cuentas?: CreditAccount[];
  totalGastado?: number;
  saldoPendiente?: number;
  cantidadCompras?: number;
  clienteFrecuente?: boolean;
  ultimosPedidos?: Sale[];
}

export interface CustomerRegisterInput {
  nombre: string;
  email: string;
  password: string;
  telefono?: string | null;
  ciudad?: string | null;
  nit?: string | null;
  direccion?: string | null;
}

export interface CustomerSession {
  customer: Customer;
  token: string;
}

export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'QR' | 'TARJETA';

export interface Sale {
  id: string;
  subtotal: number;
  descuento: number;
  total: number;
  metodoPago: PaymentMethod;
  tipoVenta: 'CONTADO' | 'CREDITO';
  usuarioId?: string;
  usuario?: Pick<User, 'id' | 'nombre' | 'email'>;
  sucursalId?: string;
  sucursal?: Sucursal;
  clienteId?: string | null;
  cliente?: Customer | null;
  cuenta?: CreditAccount | null;
  detalles?: Array<{
    id: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    productoId: string;
    producto?: Product;
  }>;
  createdAt: string;
}

export interface DailySalesSummary {
  fecha: string;
  cerrado: boolean;
  cierre?: CashClosing | null;
  totals: {
    cantidadVentas: number;
    totalVentas: number;
    totalEfectivo: number;
    totalTransferencia: number;
    totalQr: number;
    totalTarjeta: number;
    totalCredito: number;
  };
  ventas: Sale[];
}

export interface CashClosing {
  id: string;
  fecha: string;
  usuarioId: string;
  sucursalId: string;
  cantidadVentas: number;
  totalVentas: number;
  totalEfectivo: number;
  totalTransferencia: number;
  totalQr: number;
  totalTarjeta: number;
  totalCredito: number;
  montoDeclarado: number;
  diferencia: number;
  notas?: string | null;
  createdAt: string;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface User {
  id: string;
  nombre: string;
  email: string;
  role: 'ADMIN' | 'SELLER';
  activo: boolean;
  sucursalId: string;
  sucursal?: Sucursal;
  createdAt: string;
  updatedAt?: string;
}

export interface SaleItemInput {
  productoId: string;
  cantidad: number;
  descuentoItem?: number;
}

export interface SaleInput {
  usuarioId: string;
  sucursalId: string;
  clienteId?: string | null;
  metodoPago: PaymentMethod;
  tipoVenta: 'CONTADO' | 'CREDITO';
  descuento: number;
  fechaVencimiento?: string | null;
  items: SaleItemInput[];
}
