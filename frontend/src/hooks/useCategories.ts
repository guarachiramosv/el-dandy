// src/hooks/useCategories.ts
import { useEffect, useState } from 'react';
import api from '../services/api';
import { Category } from '../types';
import { getErrorMessage } from '../utils/errors';

export const useCategories = () => {
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const resp = await api.get<{ success: boolean; data: Category[] }>('/categories');
        if (resp.data.success) setData(resp.data.data);
        else setError('Error al cargar categorías');
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { data, loading, error };
};
