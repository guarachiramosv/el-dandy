import api from './api';
import { PaymentMethod, RemachadoMedida, RemachadoRemache, RemachadoTrabajo } from '../types';

export type RemachadoSummary = {
  medidas: RemachadoMedida[];
  remaches: RemachadoRemache[];
  trabajos: RemachadoTrabajo[];
};

export const fetchRemachadoSummary = async (): Promise<RemachadoSummary> => {
  const response = await api.get<{ success: boolean; data: RemachadoSummary }>('/remachado');
  return response.data.data;
};

export const createRemachadoMedida = async (data: {
  medida: string;
  descripcion?: string | null;
  stockJuegos?: number;
  stockMinimoJuegos?: number;
  precioJuego: number;
  precioMedioJuego: number;
  remachesPorJuego?: number;
  remachesPorMedioJuego?: number;
}): Promise<RemachadoMedida> => {
  const response = await api.post<{ success: boolean; data: RemachadoMedida }>('/remachado/medidas', data);
  return response.data.data;
};

export const adjustRemachadoMedidaStock = async (id: string, data: {
  cantidadJuegos: number;
  notas?: string | null;
}): Promise<RemachadoMedida> => {
  const response = await api.post<{ success: boolean; data: RemachadoMedida }>(`/remachado/medidas/${id}/stock`, data);
  return response.data.data;
};

export const createRemachadoRemache = async (data: {
  codigo: string;
  nombre: string;
  medida?: string | null;
  stock?: number;
  stockMinimo?: number;
}): Promise<RemachadoRemache> => {
  const response = await api.post<{ success: boolean; data: RemachadoRemache }>('/remachado/remaches', data);
  return response.data.data;
};

export const adjustRemachadoRemacheStock = async (id: string, data: {
  cantidad: number;
  notas?: string | null;
}): Promise<RemachadoRemache> => {
  const response = await api.post<{ success: boolean; data: RemachadoRemache }>(`/remachado/remaches/${id}/stock`, data);
  return response.data.data;
};

export const createRemachadoTrabajo = async (data: {
  usuarioId: string;
  sucursalId: string;
  clienteId?: string | null;
  metodoPago: PaymentMethod;
  tipoVenta: 'CONTADO' | 'CREDITO';
  trabajos: Array<{
    medidaId: string;
    remacheId?: string | null;
    tipoTrabajo: 'JUEGO' | 'MEDIO_JUEGO';
    resorteProductoId?: string | null;
    cantidadResortes?: number;
    gomaProductoId?: string | null;
    cantidadGomas?: number;
    seguroProductoId?: string | null;
    cantidadSeguros?: number;
    notas?: string | null;
  }>;
  accesorios?: Array<{ productoId: string; cantidad: number; precioUnitario?: number }>;
  notas?: string | null;
}): Promise<RemachadoTrabajo> => {
  const response = await api.post<{ success: boolean; data: RemachadoTrabajo }>('/remachado/trabajos', data);
  return response.data.data;
};
