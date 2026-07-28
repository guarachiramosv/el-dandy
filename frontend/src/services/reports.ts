import api from './api';

export type ReportPeriod = 'day' | 'month' | 'year' | 'all';

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
    ingresados: number;
    vendidos: number;
    editados: number;
    otrosMovimientos: number;
    stockActual: number;
  };
  items: Array<{
    productoId: string;
    codigo: string;
    descripcion: string;
    marca: string;
    condicion: string;
    categoria: string;
    sucursal: string;
    sucursalId: string;
    ubicacion?: string | null;
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
    movimientos: Array<{
      id: string;
      fecha: string;
      tipo: 'VENTA' | 'COMPRA' | 'AJUSTE' | 'TRANSFERENCIA_SALIDA' | 'TRANSFERENCIA_ENTRADA';
      sucursal: string;
      stockAnterior: number;
      stockNuevo: number;
      cantidad: number;
      usuario?: string | null;
      referenciaTipo?: string | null;
      notas?: string | null;
    }>;
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
      descripcion?: string | null;
      tipoLinea?: string;
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
  value?: string;
  sucursalId?: string;
  search?: string;
}): Promise<ProductInventoryReport> => {
  const response = await api.get<{ success: boolean; data: ProductInventoryReport }>('/reports/product-inventory', { params });
  const report = response.data.data;
  if (params.period === 'all' && report.period !== 'all') {
    throw new Error('El servidor todavia no esta actualizado para descargar todo el historico. Intenta de nuevo despues del despliegue.');
  }
  const items = report.items.map((item) => {
    const stockInicial = item.stockInicial || 0;
    const vendidos = item.vendidos || 0;
    const stockActual = item.stockActual || 0;
    const ingresados = typeof item.ingresados === 'number'
      ? item.ingresados
      : Math.max(0, stockActual - stockInicial + vendidos);
    return {
      ...item,
      fechaAgregado: item.fechaAgregado || '',
      agregadoEnPeriodo: item.agregadoEnPeriodo || false,
      stockAlAgregar: item.stockAlAgregar ?? null,
      stockInicial,
      ingresados,
      vendidos,
      stockActual,
      editados: item.editados || 0,
      otrosMovimientos: item.otrosMovimientos || 0,
      stockSucursales: item.stockSucursales || [],
      movimientos: item.movimientos || [],
    };
  });
  const totals = items.reduce(
    (acc, item) => {
      acc.stockInicial += item.stockInicial;
      acc.ingresados += item.ingresados;
      acc.vendidos += item.vendidos;
      acc.editados += item.editados;
      acc.otrosMovimientos += item.otrosMovimientos;
      acc.stockActual += item.stockActual;
      return acc;
    },
    { productos: items.length, stockInicial: 0, ingresados: 0, vendidos: 0, editados: 0, otrosMovimientos: 0, stockActual: 0 }
  );

  return {
    ...report,
    totals,
    items,
  };
};

export const fetchSalesHistoryReport = async (params: {
  period: ReportPeriod;
  value: string;
  sucursalId?: string;
}): Promise<SalesHistoryReport> => {
  const response = await api.get<{ success: boolean; data: SalesHistoryReport }>('/reports/sales-history', { params });
  return response.data.data;
};
