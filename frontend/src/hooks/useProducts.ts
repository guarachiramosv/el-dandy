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
      const params = { limit: pageSize, status, scope: scope === 'all' ? 'all' : undefined };
      const firstResponse = await api.get<{ success: boolean; data: PaginatedProducts }>('/products', {
        params: { ...params, page: 1 },
      });
      if (!firstResponse.data.success) throw new Error('Error al cargar productos');

      const totalPages = firstResponse.data.data.totalPages || 1;
      const remainingResponses = totalPages > 1
        ? await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, index) =>
              api.get<{ success: boolean; data: PaginatedProducts }>('/products', {
                params: { ...params, page: index + 2 },
              }),
            ),
          )
        : [];
      const items = [
        ...firstResponse.data.data.items,
        ...remainingResponses.flatMap((response) => {
          if (!response.data.success) throw new Error('Error al cargar productos');
          return response.data.data.items;
        }),
      ];

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
