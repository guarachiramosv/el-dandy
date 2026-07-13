// src/hooks/useProducts.ts
import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { PaginatedProducts, Product } from '../types';
import { getErrorMessage } from '../utils/errors';

import type { ProductStatusFilter } from '../services/products';

type UseProductsOptions = {
  scope?: 'branch' | 'all';
  refreshIntervalMs?: number;
  refetchOnWindowFocus?: boolean;
};

export const useProducts = (status: ProductStatusFilter = 'active', options: UseProductsOptions = {}) => {
  const scope = options.scope ?? 'branch';
  const refreshIntervalMs = options.refreshIntervalMs ?? 0;
  const refetchOnWindowFocus = options.refetchOnWindowFocus ?? true;
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (refetchOptions?: { silent?: boolean }) => {
    if (!refetchOptions?.silent) setLoading(true);
    setError(null);
    try {
      const pageSize = 500;
      const items: Product[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const resp = await api.get<{ success: boolean; data: PaginatedProducts }>('/products', {
          params: { page, limit: pageSize, status, scope: scope === 'all' ? 'all' : undefined },
        });
        if (!resp.data.success) throw new Error('Error al cargar productos');
        items.push(...resp.data.data.items);
        totalPages = resp.data.data.totalPages || 1;
        page += 1;
      } while (page <= totalPages);

      setData(items);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [scope, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refetch();
    }, 0);

    const interval = refreshIntervalMs > 0
      ? window.setInterval(() => {
          void refetch({ silent: true });
        }, refreshIntervalMs)
      : null;

    const handleFocus = () => {
      void refetch({ silent: true });
    };
    if (refetchOnWindowFocus) {
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetch, refetchOnWindowFocus, refreshIntervalMs]);

  return { data, loading, error, refetch };
};
