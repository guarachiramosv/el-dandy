import api from './api';

export type ReportPeriod = 'day' | 'month' | 'year';

type ReportUser = {
  id: string;
  nombre: string;
  email: string;
  sucursal?: { id: string; nombre: string };
};

export type CashClosingReport = {
  period: ReportPeriod;
  label: string;
  desde: string;
  hasta: string;
  totals: {
    cantidadCierres: number;
    cantidadVentas: number;
    totalVentas: number;
    totalEfectivo: number;
    totalTransferencia: number;
    totalQr: number;
    totalTarjeta: number;
    totalCredito: number;
    gastoEfectivo: number;
    gastoQr: number;
    totalGastos: number;
    netoEfectivo: number;
    netoQr: number;
    montoDeclarado: number;
    diferencia: number;
  };
  cierres: Array<{
    id: string;
    fecha: string;
    cantidadVentas: number;
    totalVentas: number;
    totalEfectivo: number;
    totalTransferencia: number;
    totalQr: number;
    totalTarjeta: number;
    totalCredito: number;
    gastoEfectivo: number;
    gastoQr: number;
    totalGastos: number;
    netoEfectivo: number;
    netoQr: number;
    montoDeclarado: number;
    diferencia: number;
    notas?: string | null;
    usuario?: ReportUser;
    sucursal?: { id: string; nombre: string };
    createdAt: string;
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
    vendidos: number;
    otrosMovimientos: number;
    stockActual: number;
  };
  items: Array<{
    productoId: string;
    codigo: string;
    descripcion: string;
    marca: string;
    categoria: string;
    sucursal: string;
    sucursalId: string;
    ubicacion?: string | null;
    stockInicial: number;
    vendidos: number;
    otrosMovimientos: number;
    stockActual: number;
    stockMinimo: number;
  }>;
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
    gastoEfectivo: number;
    gastoQr: number;
    totalGastos: number;
    netoEfectivo: number;
    netoQr: number;
    totalDisponible: number;
    cantidadCierres?: number;
    montoDeclarado?: number;
    diferencia?: number;
    totalCierreVentas?: number;
    cierreEfectivo?: number;
    cierreQr?: number;
  };
  productosVendidos: Array<{
    productoId: string;
    codigo: string;
    descripcion: string;
    marca: string;
    categoria: string;
    sucursal: string;
    cantidad: number;
    total: number;
  }>;
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
      producto?: {
        codigo: string;
        descripcion: string;
        marca: string;
        categoria?: { nombre: string };
      };
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
  cierres: CashClosingReport['cierres'];
};

export const fetchCashClosingReport = async (params: {
  period: ReportPeriod;
  value: string;
  sucursalId?: string;
  usuarioId?: string;
}): Promise<CashClosingReport> => {
  const response = await api.get<{ success: boolean; data: CashClosingReport }>('/reports/cash-closings', { params });
  return response.data.data;
};

export const fetchProductInventoryReport = async (params: {
  period: ReportPeriod;
  value: string;
  sucursalId?: string;
  search?: string;
}): Promise<ProductInventoryReport> => {
  const response = await api.get<{ success: boolean; data: ProductInventoryReport }>('/reports/product-inventory', { params });
  return response.data.data;
};

export const fetchSalesHistoryReport = async (params: {
  period: ReportPeriod;
  value: string;
  sucursalId?: string;
}): Promise<SalesHistoryReport> => {
  const response = await api.get<{ success: boolean; data: SalesHistoryReport }>('/reports/sales-history', { params });
  return response.data.data;
};
