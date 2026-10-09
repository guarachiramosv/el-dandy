import api from './api';

export type FinancialCategory = 'GASTO_NEGOCIO' | 'RETIRO_PERSONAL' | 'APORTE_PROPIETARIO';

export type FinancialMovement = {
  id: string;
  categoria: FinancialCategory;
  descripcion: string;
  monto: number;
  fecha: string;
  notas?: string | null;
  usuario: { id: string; nombre: string };
  sucursal?: { id: string; nombre: string } | null;
};

export type FinanceSummary = {
  month: string;
  estado: { codigo: 'VA_BIEN' | 'ATENCION' | 'CON_PERDIDAS' | 'SIN_DATOS'; titulo: string; mensaje: string };
  rentabilidad: {
    cantidadVentas: number;
    totalVentas: number;
    costoProductos: number;
    gananciaBruta: number;
    totalGastos: number;
    gastosAdministrador: number;
    gananciaNeta: number;
    margenNeto: number;
  };
  cuenta: {
    saldoInicial: number;
    ingresosBanco: number;
    egresosBanco: number;
    saldoEsperado: number;
    saldoReal: number | null;
    diferenciaBanco: number | null;
  };
  flujo: {
    depositosEfectivo: number;
    ventasQr: number;
    ventasTransferencia: number;
    ventasTarjeta: number;
    cobrosQr: number;
    cobrosTransferencia: number;
    cobrosTarjeta: number;
    aportesPropietario: number;
    gastosCajaQr: number;
    comprasMercaderia: number;
    gastosAdministrador: number;
    retirosPersonales: number;
  };
  movimientos: FinancialMovement[];
};

export const fetchFinanceSummary = async (month: string): Promise<FinanceSummary> => {
  const response = await api.get('/finances/summary', { params: { month } });
  return response.data.data;
};

export const createFinancialMovement = async (data: {
  categoria: FinancialCategory;
  descripcion: string;
  monto: number;
  fecha: string;
  sucursalId?: string | null;
  notas?: string | null;
}): Promise<FinancialMovement> => {
  const response = await api.post('/finances/movements', data);
  return response.data.data;
};

export const deleteFinancialMovement = async (id: string): Promise<void> => {
  await api.delete(`/finances/movements/${id}`);
};

export const saveMonthlyBalance = async (data: {
  mes: string;
  saldoInicial: number;
  saldoReal?: number | null;
}): Promise<void> => {
  await api.put('/finances/balance', data);
};
