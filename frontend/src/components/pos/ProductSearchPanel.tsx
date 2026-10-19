import { PackageOpen, Search, ShoppingCart, X } from "lucide-react";
import type { Product } from "../../types";
import { productImageUrl } from "../../utils/images";
import type { CartItem } from "./posDomain";
import { formatQuantity, money, productConditionClass, productConditionLabel, productStep } from "./posDomain";

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
    if (props.products.length === 1 && props.getAvailableStock(product) >= productStep(product) && !props.isClosed) {
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
          placeholder="Buscar por código, nombre o estante..."
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
          <h3 className="font-bold text-white">Resultados</h3>
          <span className="text-xs text-gray-400">
            {props.searching ? "Buscando..." : props.hasSearch ? `${props.products.length} resultados` : "Escribe para buscar"}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[600px] table-fixed text-left">
            <colgroup>
              <col className="w-[112px]" />
              <col />
              <col className="w-[76px]" />
              <col className="w-[62px]" />
              <col className="w-[88px]" />
              <col className="w-[96px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#111315] text-[11px] uppercase tracking-wide text-gray-500">
              <tr className="border-b border-gray-800">
                <th className="px-3 py-3 font-semibold">Código</th>
                <th className="px-3 py-3 font-semibold">Producto</th>
                <th className="px-2 py-3 text-center font-semibold">Estado</th>
                <th className="px-2 py-3 text-center font-semibold">Stock</th>
                <th className="px-2 py-3 text-right font-semibold">Precio</th>
                <th className="px-2 py-3 text-center font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/90">
              {props.products.map((product) => {
                const selected = props.cart.find((item) => item.product.id === product.id);
                const availableStock = props.getAvailableStock(product);
                const outOfStock = availableStock < productStep(product);
                const image = productImageUrl(product.imagenes?.[0]?.url || product.imagen);
                return (
                  <tr key={product.id} className="group bg-[#15171a] transition-colors hover:bg-[#1a1d20]">
                    <td className="px-3 py-3 align-middle">
                      <span className="block break-all font-mono text-xs font-semibold leading-5 text-gray-200" title={product.codigo}>
                        {product.codigo}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-700 bg-[#0d0f11]">
                          {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <PackageOpen size={19} className="text-gray-600" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-100" title={product.descripcion}>{product.descripcion}</p>
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {[product.marca, product.ubicacion ? `Estante ${product.ubicacion}` : null].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                          </p>
                          {selected && <p className="mt-1 text-[11px] font-semibold text-green-400">En venta: {formatQuantity(selected.cantidad, product)}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center align-middle"><span className={`inline-flex rounded border px-2 py-1 text-[11px] font-semibold ${productConditionClass(product.condicion)}`}>{productConditionLabel(product.condicion)}</span></td>
                    <td className={`px-2 py-3 text-center text-sm font-bold ${availableStock > 0 ? "text-green-400" : "text-red-300"}`}>{availableStock.toLocaleString("es-BO", { maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-3 text-right text-sm font-bold text-primary-light">{money(product.precioVenta)}</td>
                    <td className="px-2 py-3 text-center">
                      <button type="button" onClick={() => props.onAddProduct(product)} disabled={outOfStock || props.isClosed} className="w-full whitespace-nowrap rounded bg-primary px-2 py-2 text-xs font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400">
                        {outOfStock ? "Sin stock" : "Agregar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
