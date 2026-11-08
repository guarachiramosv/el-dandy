import { PackageOpen, Search, ShoppingCart, X } from "lucide-react";
import type { Product } from "../../types";
import { ProductSearchCard } from "./ProductSearchCard";
import type { CartItem } from "./posDomain";
import { productStep } from "./posDomain";

interface ProductSearchPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  hasSearch: boolean;
  searching: boolean;
  searchError: string | null;
  products: Product[];
  cart: CartItem[];
  isClosed: boolean;
  getAvailableStock: (product: Product) => number;
  onAddProduct: (product: Product) => void;
}

export function ProductSearchPanel(props: ProductSearchPanelProps) {
  const addOnlyResult = () => {
    const product = props.products[0];
    if (props.products.length === 1 && props.getAvailableStock(product) - (props.cart.find((item) => item.product.id === product.id)?.cantidad || 0) >= productStep(product) && !props.isClosed) {
      props.onAddProduct(product);
    }
  };

  return (
    <section className="flex min-h-[620px] min-w-0 flex-col">
      <header className="mb-3">
        <h2 className="flex items-center gap-3 text-2xl font-bold text-white">
          <ShoppingCart className="text-primary" size={29} /> Punto de Venta
        </h2>
        <p className="mt-1 text-sm text-gray-400">Busca y agrega productos a la venta.</p>
      </header>

      <div className="pos-search-shell mb-3 h-14 shrink-0 border-primary/80">
        <Search className="pos-search-icon" />
        <input
          type="text"
          aria-label="Buscar producto"
          autoComplete="off"
          placeholder="Buscar por nombre, código, marca o ubicación..."
          className="pos-search-input text-base font-medium"
          value={props.searchTerm}
          onChange={(event) => props.onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") props.onClearSearch();
            if (event.key === "Enter") addOnlyResult();
          }}
        />
        {props.hasSearch && (
          <button type="button" onClick={props.onClearSearch} className="pos-search-clear" aria-label="Borrar búsqueda" title="Borrar búsqueda">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-gray-800 bg-[#15171a]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 px-4">
          <h3 className="font-bold text-white">Productos</h3>
          <span className="text-xs text-gray-400">
            {props.searching ? "Buscando..." : props.hasSearch ? `${props.products.length} resultados` : "Escribe para buscar"}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="divide-y divide-gray-800">
            {props.products.map((product) => (
              <ProductSearchCard
                key={product.id}
                product={product}
                availableStock={props.getAvailableStock(product)}
                selectedQuantity={props.cart.find((item) => item.product.id === product.id)?.cantidad || 0}
                isClosed={props.isClosed}
                onAdd={props.onAddProduct}
              />
            ))}
          </div>
          {props.products.length === 0 && (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <PackageOpen size={34} className="mb-3 text-gray-700" />
              <p className="text-sm font-medium text-gray-300">{props.searching ? "Buscando productos..." : props.searchError ? "No se pudo completar la búsqueda." : props.hasSearch ? "No encontramos productos con esa búsqueda." : "Busca un producto para comenzar la venta."}</p>
              <p className="mt-1 text-xs text-gray-500">{props.searchError || (props.hasSearch ? "Prueba con otro código, nombre o estante." : "Puedes buscar por código, descripción, marca o ubicación.")}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
