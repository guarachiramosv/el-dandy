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
  descripcionDetallada?: string | null;
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
  stockSucursales?: ProductBranchStock[];
  createdAt?: string;
};

export type ProductBranchStock = {
  id: string;
  productoId?: string;
  sucursalId: string;
  sucursal?: { id: string; nombre: string; whatsapp?: string | null };
  stock: number;
  ubicacion?: string | null;
  activo?: boolean;
  estado?: ProductStatus;
  createdAt?: string;
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

export type PaginatedProducts = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ReportPeriod = 'day' | 'month' | 'year' | 'all';

export type ReportUser = {
  id: string;
  nombre: string;
  email?: string;
  sucursal?: { id: string; nombre: string };
};

export type SalesHistoryReport = {
  period: ReportPeriod;
  label: string;
  desde: string;
  hasta: string;
  totals: {
    cantidadVentas: number;
    cantidadItems: number;
    unidadesVendidas: number;
    subtotal: number;
    descuento: number;
    totalVentas: number;
    totalEfectivo: number;
    totalTransferencia: number;
    totalQr: number;
    totalTarjeta: number;
    totalCredito: number;
    totalCobrosCredito: number;
    cobroCreditoEfectivo: number;
    cobroCreditoTransferencia: number;
    cobroCreditoQr: number;
    cobroCreditoTarjeta: number;
    gastoEfectivo: number;
    gastoQr: number;
    totalGastos: number;
    netoEfectivo: number;
    netoQr: number;
    totalDisponible: number;
    cantidadCierres?: number;
    montoDeclarado?: number;
    diferencia?: number;
  };
  ventas: Array<{
    id: string;
    subtotal: number;
    descuento: number;
    total: number;
    metodoPago: string;
    tipoVenta: string;
    createdAt: string;
    usuario?: ReportUser;
    sucursal?: { id: string; nombre: string };
    cliente?: { id: string; nombre: string } | null;
    detalles?: Array<{
      id: string;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
      descripcion?: string | null;
      tipoLinea?: string;
      producto?: {
        codigo: string;
        descripcion: string;
        marca?: string | null;
        categoria?: { nombre: string };
      } | null;
    }>;
  }>;
  gastos: Array<{
    id: string;
    motivo: string;
    monto: number;
    metodoPago: 'EFECTIVO' | 'QR';
    notas?: string | null;
    createdAt: string;
    usuario?: ReportUser;
    sucursal?: { id: string; nombre: string };
  }>;
  cierres: Array<{
    id: string;
    fecha: string;
    notas?: string | null;
    usuario?: ReportUser;
    sucursal?: { id: string; nombre: string };
  }>;
};

export type ProductInventoryReport = {
  period: ReportPeriod;
  label: string;
  desde: string;
  hasta: string;
  totals: {
    productos: number;
    stockInicial: number;
    ingresados: number;
    vendidos: number;
    editados: number;
    otrosMovimientos: number;
    stockActual: number;
  };
  items: Array<{
    productoId: string;
    codigo: string;
    codigoRepuesto?: string | null;
    descripcion: string;
    marca?: string | null;
    condicion: string;
    categoria: string;
    sucursal: string;
    sucursalId: string;
    ubicacion?: string | null;
    precioVenta: number;
    fechaAgregado: string;
    agregadoEnPeriodo: boolean;
    stockAlAgregar?: number | null;
    stockInicial: number;
    ingresados: number;
    vendidos: number;
    editados: number;
    otrosMovimientos: number;
    stockActual: number;
    stockMinimo: number;
    stockSucursales?: Array<{
      sucursalId: string;
      sucursal: string;
      stock: number;
      fechaAgregado: string;
    }>;
  }>;
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
