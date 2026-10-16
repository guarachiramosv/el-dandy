import { useState } from "react";
import { Plus } from "lucide-react";
import type { Provider } from "../../../types";
import type { PurchaseCurrency } from "../../../domain/purchaseDetails";
import QuickProviderModal from "./QuickProviderModal";

type PurchaseSourceFieldsProps = {
  providers: Provider[];
  proveedorId: string | null;
  currency: PurchaseCurrency;
  precioBs: number;
  precioReales: number;
  tipoCambio: number;
  onProveedorChange: (value: string) => void;
  onProviderCreated: (provider: Provider) => void;
  onCurrencyChange: (currency: PurchaseCurrency) => void;
  onPrecioBsChange: (value: number) => void;
  onPrecioRealesChange: (value: number) => void;
  onTipoCambioChange: (value: number) => void;
};

export default function PurchaseSourceFields({
  providers,
  proveedorId,
  currency,
  precioBs,
  precioReales,
  tipoCambio,
  onProveedorChange,
  onProviderCreated,
  onCurrencyChange,
  onPrecioBsChange,
  onPrecioRealesChange,
  onTipoCambioChange,
}: PurchaseSourceFieldsProps) {
  const [quickProviderOpen, setQuickProviderOpen] = useState(false);

  return (
    <>
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-300">Proveedor (opcional)</label>
        <div className="flex gap-2">
          <select className="premium-input" value={proveedorId || ""} onChange={(event) => onProveedorChange(event.target.value)}>
            <option value="">Sin proveedor</option>
            {providers.map(provider => <option key={provider.id} value={provider.id}>{provider.nombre}</option>)}
          </select>
          <button type="button" onClick={() => setQuickProviderOpen(true)} className="btn-secondary shrink-0 px-3" title="Crear proveedor">
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-300">Moneda de compra</label>
        <select className="premium-input" value={currency} onChange={(event) => onCurrencyChange(event.target.value as PurchaseCurrency)}>
          <option value="BOB">Bolivianos (Bs)</option>
          <option value="BRL">Reales brasilenos (R$)</option>
        </select>
      </div>

      {currency === "BRL" && (
        <>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Precio de compra unitario (R$)</label>
            <input className="premium-input" type="text" inputMode="decimal" value={precioReales} onChange={(event) => onPrecioRealesChange(Number(event.target.value))} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-300">Tipo de cambio (Bs por R$)</label>
            <input className="premium-input" type="text" inputMode="decimal" value={tipoCambio} onChange={(event) => onTipoCambioChange(Number(event.target.value))} />
          </div>
        </>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-300">Precio de compra unitario (Bs)</label>
        <input className="premium-input" type="text" inputMode="decimal" value={precioBs} onChange={(event) => onPrecioBsChange(Number(event.target.value))} readOnly={currency === "BRL"} />
      </div>

      {quickProviderOpen && (
        <QuickProviderModal
          onClose={() => setQuickProviderOpen(false)}
          onCreated={(provider) => {
            onProviderCreated(provider);
            onProveedorChange(provider.id);
            setQuickProviderOpen(false);
          }}
        />
      )}
    </>
  );
}
