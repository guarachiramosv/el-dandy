import { useEffect, useMemo, useState } from "react";
import type { Product } from "../../types";
import { filterAndSortBySearch, getSearchTerms, normalizeSearchText } from "../../utils/fuzzySearch";

type ProductSearch = (query: string) => Promise<Product[]>;

export function useProductSearch(searchProducts: ProductSearch) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSearch = normalizeSearchText(searchTerm).length > 0;

  useEffect(() => {
    const query = searchTerm.trim();
    if (!query) {
      const resetTimer = window.setTimeout(() => {
        setResults([]);
        setError(null);
        setSearching(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchProducts(query)
        .then((items) => {
          if (cancelled) return;
          setResults(items);
          setError(null);
        })
        .catch((searchError: unknown) => {
          if (cancelled) return;
          setResults([]);
          setError(searchError instanceof Error ? searchError.message : "No se pudo buscar en el inventario.");
        })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchProducts, searchTerm]);

  const filteredProducts = useMemo(() => {
    if (getSearchTerms(searchTerm).length === 0) return [];
    const uniqueProducts = Array.from(new Map(results.map((product) => [product.id, product])).values());
    return filterAndSortBySearch(
      uniqueProducts,
      searchTerm,
      (product) => [
        { value: product.codigo, weight: 2 },
        { value: product.codigoRepuesto, weight: 1.9 },
        { value: product.descripcion, weight: 1.5 },
        { value: product.descripcionDetallada, weight: 0.8 },
        { value: product.ubicacion, weight: 1.25 },
        { value: product.marca, weight: 1 },
        { value: product.categoria?.nombre, weight: 0.9 },
        { value: product.sucursal?.nombre, weight: 0.7 },
      ],
      (product) => product.descripcion,
    );
  }, [results, searchTerm]);

  return {
    searchTerm,
    setSearchTerm,
    clearSearch: () => setSearchTerm(""),
    hasSearch,
    filteredProducts,
    searching,
    error,
  };
}
