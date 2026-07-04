// src/hooks/useProducts.ts
import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { PaginatedProducts, Product } from '../types';
import { getErrorMessage } from '../utils/errors';

import type { ProductStatusFilter } from '../services/products';

export const useProducts = (status: ProductStatusFilter = 'active') => {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<{ success: boolean; data: PaginatedProducts }>('/products', {
        params: { limit: 100, status },
      });
      if (resp.data.success) setData(resp.data.data.items);
      else setError('Error al cargar productos');
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refetch();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refetch]);

  return { data, loading, error, refetch };
};
