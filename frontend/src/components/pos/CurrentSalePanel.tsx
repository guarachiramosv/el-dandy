import { Banknote, CreditCard, FileText, Minus, PackageOpen, Plus, QrCode, Receipt, ShoppingCart, Trash2 } from "lucide-react";
import type { PaymentMethod } from "../../types";
import { productImageUrl } from "../../utils/images";
import { money, sellerPaymentOptions, type CartItem, type SellerPaymentOption } from "./posDomain";

interface CurrentSalePanelProps {
  cart: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  totalQuantity: number;
  selectedPaymentOption: SellerPaymentOption;
  paymentMethod: PaymentMethod;
  saleType: "CONTADO" | "CREDITO";
  mixedCashInput: string;
  mixedQrAmount: number;
  dueDate: string;
  isClosed: boolean;
  onClear: () => void;
  onChangeQuantity: (productId: string, direction: -1 | 1) => void;
  onRemoveProduct: (productId: string) => void;
  onDiscountChange: (value: number) => void;
  onPaymentOptionChange: (option: SellerPaymentOption) => void;
  onMixedCashChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onCheckout: () => void;
}

export function CurrentSalePanel(props: CurrentSalePanelProps) {
  return (
    <aside className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-md border border-gray-800 bg-[#15171a] xl:sticky xl:top-0 xl:max-h-[calc(100vh-6.5rem)]">
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-gray-800 px-4">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold text-white"><Receipt className="text-primary" size={22} /> Venta actual</h3>
          <p className="mt-1 text-xs text-gray-500">{props.cart.length} productos · {props.totalQuantity.toLocaleString("es-BO", { maximumFractionDigits: 2 })} cantidad total</p>
        </div>
        <button type="button" onClick={props.onClear} disabled={props.cart.length === 0} className="btn-secondary flex items-center gap-2 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">
          <Trash2 size={16} /> Limpiar venta
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[minmax(0,1fr)_112px_88px_36px] gap-2 border-b border-gray-800 bg-[#111315] px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          <span>Producto</span><span className="text-center">Cant.</span><span className="text-right">Subtotal</span><span />
        </div>
        {props.cart.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <ShoppingCart size={34} className="mb-3 text-gray-700" />
            <p className="text-sm font-medium text-gray-300">La venta está vacía</p>
            <p className="mt-1 text-xs text-gray-500">Agrega productos desde los resultados de búsqueda.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {props.cart.map((item) => {
              const image = productImageUrl(item.product.imagenes?.[0]?.url || item.product.imagen);
              return (
                <div key={item.product.id} className="grid grid-cols-[minmax(0,1fr)_112px_88px_36px] items-center gap-2 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-700 bg-[#0d0f11]">
                      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <PackageOpen size={18} className="text-gray-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-gray-200">{item.product.codigo}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-gray-400">{item.product.descripcion}</p>
                      <p className="mt-1 text-[11px] text-gray-500">{money(item.product.precioVenta)} c/u</p>
                    </div>
                  </div>
                  <div className="flex h-9 items-center justify-between overflow-hidden rounded border border-gray-700 bg-[#111315]">
                    <button type="button" onClick={() => props.onChangeQuantity(item.product.id, -1)} className="flex h-full w-8 items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white" aria-label="Reducir cantidad"><Minus size={14} /></button>
                    <span className="min-w-0 text-center text-xs font-semibold text-white">{item.cantidad.toLocaleString("es-BO", { maximumFractionDigits: 2 })}</span>
                    <button type="button" onClick={() => props.onChangeQuantity(item.product.id, 1)} className="flex h-full w-8 items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white" aria-label="Aumentar cantidad"><Plus size={14} /></button>
                  </div>
                  <span className="text-right text-xs font-semibold text-gray-100">{money(item.product.precioVenta * item.cantidad)}</span>
                  <button type="button" onClick={() => props.onRemoveProduct(item.product.id)} className="flex h-9 w-9 items-center justify-center rounded border border-red-500/40 text-red-400 transition-colors hover:bg-red-500/10" aria-label={`Quitar ${item.product.descripcion}`}><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-800 bg-[#121416] p-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-gray-400"><span>Subtotal</span><span className="font-semibold text-gray-200">{money(props.subtotal)}</span></div>
          <label className="flex items-center justify-between gap-4 text-gray-400">
            <span>Descuento (Bs)</span>
            <input type="number" min="0" max={props.subtotal} step="0.01" inputMode="decimal" value={props.discount} onChange={(event) => props.onDiscountChange(event.target.valueAsNumber)} className="h-9 w-32 rounded border border-gray-700 bg-[#0f1113] px-3 text-right text-sm text-white outline-none focus:border-primary" />
          </label>
          <div className="flex items-center justify-between border-t border-gray-700 pt-3"><span className="text-lg font-bold text-white">Total</span><span className="text-2xl font-black text-primary">{money(props.total)}</span></div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-gray-200">Forma de pago</p>
          <div className="grid grid-cols-4 gap-2">
            {sellerPaymentOptions.map((option) => (
              <button key={option} type="button" onClick={() => props.onPaymentOptionChange(option)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded border px-1 text-[11px] font-semibold transition-colors ${props.selectedPaymentOption === option ? "border-primary bg-primary/10 text-primary-light" : "border-gray-700 bg-[#181a1e] text-gray-300 hover:border-gray-600"}`}>
                {option === "EFECTIVO" ? <Banknote size={17} /> : option === "QR" ? <QrCode size={17} /> : option === "MIXTO" ? <CreditCard size={17} /> : <FileText size={17} />}
                <span>{option === "EFECTIVO" ? "Efectivo" : option === "CREDITO" ? "Crédito" : option.charAt(0) + option.slice(1).toLowerCase()}</span>
              </button>
            ))}
          </div>
        </div>

        {props.paymentMethod === "MIXTO" && props.saleType === "CONTADO" && (
          <div className="mt-3 grid grid-cols-2 gap-3 rounded border border-primary/25 bg-primary/5 p-3 text-sm">
            <label className="text-gray-300">
              <span className="mb-1 block text-xs">Monto en efectivo</span>
              <input type="text" inputMode="decimal" value={props.mixedCashInput} onChange={(event) => props.onMixedCashChange(event.target.value)} placeholder="0,00" className="premium-input" />
            </label>
            <div className="flex flex-col justify-end text-gray-400"><span className="text-xs">Monto por QR</span><strong className="mt-2 text-base text-primary-light">{money(props.mixedQrAmount)}</strong></div>
          </div>
        )}

        {props.saleType === "CREDITO" && (
          <label className="mt-3 block text-sm text-gray-400"><span className="mb-1 block">Fecha de vencimiento</span><input type="date" value={props.dueDate} onChange={(event) => props.onDueDateChange(event.target.value)} className="premium-input" /></label>
        )}

        <button type="button" onClick={props.onCheckout} disabled={props.cart.length === 0 || props.isClosed} className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-md bg-primary px-5 text-lg font-black text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400">
          <Banknote size={21} /> Cobrar {money(props.total)}
        </button>
      </div>
    </aside>
  );
}
