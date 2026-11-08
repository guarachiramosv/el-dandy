import { MapPin, PackageOpen } from "lucide-react";
import type { Product } from "../../types";
import { productImageUrl } from "../../utils/images";
import { formatQuantity, money, productConditionClass, productConditionLabel, productStep } from "./posDomain";

interface ProductSearchCardProps {
  product: Product;
  availableStock: number;
  selectedQuantity: number;
  isClosed: boolean;
  onAdd: (product: Product) => void;
}

export function ProductSearchCard({ product, availableStock, selectedQuantity, isClosed, onAdd }: ProductSearchCardProps) {
  const remaining = Math.max(0, availableStock - selectedQuantity);
  const canAdd = Number.isFinite(remaining) && remaining >= productStep(product);
  const image = productImageUrl(product.imagenes?.[0]?.url || product.imagen);
  return (
    <article className="min-w-0 p-4 transition-colors hover:bg-white/[0.02]">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-700 bg-[#0d0f11]">
          {image ? <img src={image} alt="" loading="lazy" className="h-full w-full object-contain" /> : <PackageOpen size={25} className="text-gray-600" />}
        </div>
        <div className="min-w-0 flex-1 basis-48">
          <h4 className="break-words text-base font-bold leading-snug text-gray-100">{product.descripcion}</h4>
          <p className="mt-1 break-words text-xs text-gray-400">Código: {product.codigo} · Marca: {product.marca || "Sin marca"}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={`rounded border px-2 py-1 font-semibold ${productConditionClass(product.condicion)}`}>{productConditionLabel(product.condicion)}</span>
            <span className="inline-flex items-center gap-1 rounded border border-gray-700 px-2 py-1 text-gray-300"><MapPin size={13} />Ubicación: {product.ubicacion || "Sin asignar"}</span>
            <span className={`rounded border px-2 py-1 ${canAdd ? "border-green-500/30 text-green-300" : "border-amber-500/30 text-amber-200"}`}>Disponible: {formatQuantity(availableStock, product)}</span>
          </div>
          {selectedQuantity > 0 && <p className="mt-2 text-xs text-primary-light">En venta: {formatQuantity(selectedQuantity, product)} · Restante: {formatQuantity(remaining, product)}</p>}
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
          <p className="text-base font-bold text-primary-light">{money(product.precioVenta)}</p>
          <button type="button" onClick={() => onAdd(product)} disabled={!canAdd || isClosed} aria-label={`Agregar ${product.descripcion}`} className="rounded bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400">{!canAdd ? (selectedQuantity > 0 ? "Stock en venta" : "Sin stock") : "Agregar"}</button>
        </div>
      </div>
      <details className="group mt-3 rounded border border-gray-700 bg-black/10 open:border-primary/40">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-primary"><span className="group-open:hidden">Ver detalles</span><span className="hidden group-open:inline">Cerrar detalles</span></summary>
        <div className="space-y-3 border-t border-gray-700 p-3">
          <p className="whitespace-pre-wrap break-words text-sm text-gray-300">{product.descripcionDetallada?.trim() || "Sin descripción adicional registrada."}</p>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {[ ["Código de repuesto", product.codigoRepuesto || "Sin registrar"], ["Categoría", product.categoria?.nombre || "Sin categoría"], ["Sucursal", product.sucursal?.nombre || "Sin registrar"], ["Unidad de venta", product.unidadVenta === "METRO" ? "Metro" : "Unidad"] ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-gray-500">{label}</dt><dd className="break-words text-gray-200">{value}</dd></div>)}
          </dl>
          {image && <a href={image} target="_blank" rel="noreferrer" className="inline-block rounded focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Ampliar imagen de ${product.descripcion}`}><img src={image} alt={product.descripcion} loading="lazy" className="max-h-64 max-w-full rounded object-contain" /></a>}
          <p className="text-xs text-gray-500">El stock se valida nuevamente al confirmar la venta.</p>
        </div>
      </details>
    </article>
  );
}
