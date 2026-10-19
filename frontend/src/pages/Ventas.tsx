import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  LockKeyhole,
  Printer,
  X,
} from "lucide-react";
import { Customer, DailySalesSummary, PaymentMethod, Sale } from "../types";
import { createSale, fetchDailySalesSummary } from "../services/sales";
import { getCurrentUser } from "../services/auth";
import { createCustomer, fetchCustomers, updateCustomer } from "../services/customers";
import { fetchProductById, searchProductsForSale } from "../services/products";
import { buildThermalReceiptHtml } from "../utils/thermalReceipt";
import { CorrectionBanner } from "../components/pos/CorrectionBanner";
import { CurrentSalePanel } from "../components/pos/CurrentSalePanel";
import { ProductSearchPanel } from "../components/pos/ProductSearchPanel";
import { formatQuantity, money, productConditionClass, productConditionLabel, validateInvoiceCustomer, validateSaleDraft, type CartItem, type SellerPaymentOption } from "../components/pos/posDomain";
import { useProductSearch } from "../components/pos/useProductSearch";
import { useSaleCart } from "../components/pos/useSaleCart";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });

const formatInputDate = (value: string) => {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Ocurrio un error inesperado.";
const salePaymentLabel = (tipoVenta: "CONTADO" | "CREDITO", metodoPago: PaymentMethod) =>
  tipoVenta === "CREDITO" ? "CREDITO" : metodoPago;

export default function Ventas() {
  const location = useLocation();
  const navigate = useNavigate();
  const correctionParams = new URLSearchParams(location.search);
  const correctionDate = correctionParams.get("fechaNegocio");
  const correctionClosingId = correctionParams.get("cierre");
  const correctionReasonFromAdmin = correctionParams.get("motivo") || "";
  const isCorrectionMode = Boolean(correctionDate && correctionClosingId);
  const productToAddFromInventory = (location.state as { addProductId?: string } | null)?.addProductId;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySalesSummary | null>(null);
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>("EFECTIVO");
  const [montoEfectivoMixto, setMontoEfectivoMixto] = useState("");
  const [tipoVenta, setTipoVenta] = useState<"CONTADO" | "CREDITO">("CONTADO");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceCustomerName, setInvoiceCustomerName] = useState("");
  const [invoiceCustomerNit, setInvoiceCustomerNit] = useState("");
  const [invoiceCustomerPhone, setInvoiceCustomerPhone] = useState("");
  const [correctionReason, setCorrectionReason] = useState(correctionReasonFromAdmin);
  const user = getCurrentUser();
  const {
    cart,
    discount: descuento,
    subtotal,
    total,
    totalQuantity,
    getAvailableStock,
    addProduct,
    changeQuantity,
    removeProduct,
    setDiscount: setDescuento,
    clear: clearCart,
  } = useSaleCart({ branchId: user?.sucursalId, onError: setMessage });
  const {
    searchTerm,
    setSearchTerm,
    clearSearch,
    hasSearch,
    filteredProducts,
    searching: searchingProducts,
    error: searchError,
  } = useProductSearch(searchProductsForSale);

  const loadDailySummary = useCallback(async () => {
    try {
      setDailySummary(await fetchDailySalesSummary(correctionDate || undefined));
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    }
  }, [correctionDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchCustomers().then(setCustomers).catch((err: unknown) => setMessage(getErrorMessage(err)));
      void loadDailySummary();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDailySummary]);

  useEffect(() => {
    if (tipoVenta === "CONTADO" && metodoPago !== "EFECTIVO" && metodoPago !== "QR" && metodoPago !== "MIXTO") {
      const timer = window.setTimeout(() => setMetodoPago("EFECTIVO"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [metodoPago, tipoVenta]);

  const selectedPaymentOption: SellerPaymentOption = tipoVenta === "CREDITO" ? "CREDITO" : metodoPago === "MIXTO" ? "MIXTO" : metodoPago === "QR" ? "QR" : "EFECTIVO";
  const mixedCashAmount = Number(montoEfectivoMixto.replace(",", ".")) || 0;
  const mixedQrAmount = Math.max(Math.round((total - mixedCashAmount) * 100) / 100, 0);

  const selectPaymentOption = (option: SellerPaymentOption) => {
    setMessage(null);
    if (option === "CREDITO") {
      setTipoVenta("CREDITO");
      setMetodoPago("EFECTIVO");
      return;
    }
    setTipoVenta("CONTADO");
    setMetodoPago(option);
    if (option !== "MIXTO") setMontoEfectivoMixto("");
    setFechaVencimiento("");
  };

  useEffect(() => {
    if (!productToAddFromInventory) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchProductById(productToAddFromInventory)
        .then((product) => {
          if (cancelled) return;
        const added = addProduct(product);
        if (added) setMessage("Producto agregado al carrito desde Inventario.");
        })
        .catch(() => {
          if (!cancelled) setMessage("No se encontro el producto seleccionado desde Inventario.");
        })
        .finally(() => {
          if (!cancelled) navigate(".", { replace: true, state: null });
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addProduct, navigate, productToAddFromInventory]);

  const openInvoice = () => {
    setMessage(null);
    const validationError = validateSaleDraft({
      hasUser: Boolean(user),
      cart,
      isClosed: Boolean(dailySummary?.cerrado),
      isCorrectionMode,
      correctionReason,
      saleType: tipoVenta,
      dueDate: fechaVencimiento,
      paymentMethod: metodoPago,
      mixedCashAmount,
      subtotal,
      discount: descuento,
      total,
    });
    if (validationError) return setMessage(validationError);
    setInvoiceCustomerName("");
    setInvoiceCustomerNit("");
    setInvoiceCustomerPhone("");
    setInvoiceOpen(true);
  };

  const resolveInvoiceCustomerId = async () => {
    const name = invoiceCustomerName.trim();
    const nit = invoiceCustomerNit.trim();
    const phone = invoiceCustomerPhone.trim();

    const customerError = validateInvoiceCustomer(name, phone, tipoVenta);
    if (customerError) throw new Error(customerError);

    const normalizedName = name.toLowerCase();
    const existing = customers.find((customer) => {
      const customerName = customer.nombre.trim().toLowerCase();
      const companyName = customer.empresa?.trim().toLowerCase();
      return customerName === normalizedName || companyName === normalizedName || (nit && customer.nit === nit);
    });

    if (existing) {
      if (tipoVenta === "CREDITO" && phone && !existing.telefono) {
        const updated = await updateCustomer(existing.id, { telefono: phone });
        setCustomers((prev) => prev.map((customer) => customer.id === updated.id ? updated : customer));
      }
      return existing.id;
    }

    const created = await createCustomer({
      nombre: name,
      nit: nit || null,
      telefono: phone || null,
      notas: "Creado desde punto de venta",
    });
    setCustomers((prev) => [created, ...prev]);
    return created.id;
  };

  const handleConfirmSale = async () => {
    setMessage(null);
    const validationError = validateSaleDraft({
      hasUser: Boolean(user),
      cart,
      isClosed: Boolean(dailySummary?.cerrado),
      isCorrectionMode,
      correctionReason,
      saleType: tipoVenta,
      dueDate: fechaVencimiento,
      paymentMethod: metodoPago,
      mixedCashAmount,
      subtotal,
      discount: descuento,
      total,
    });
    if (validationError || !user) return setMessage(validationError || "Debes iniciar sesión nuevamente.");

    setSaving(true);
    try {
      const clienteId = await resolveInvoiceCustomerId();
      const sale = await createSale({
        usuarioId: user.id,
        sucursalId: user.sucursalId,
        clienteId,
        metodoPago,
        tipoVenta,
        fechaVencimiento: tipoVenta === "CREDITO" && fechaVencimiento ? fechaVencimiento : null,
        fechaNegocio: correctionDate,
        cierreCorregidoId: correctionClosingId,
        motivoCorreccion: isCorrectionMode ? correctionReason.trim() : null,
        pagos: metodoPago === "MIXTO" ? [
          { metodoPago: "EFECTIVO", monto: mixedCashAmount },
          { metodoPago: "QR", monto: mixedQrAmount },
        ] : undefined,
        descuento,
        items: cart.map((item) => ({
          productoId: item.product.id,
          cantidad: item.cantidad,
          descuentoItem: 0,
        })),
      });
      clearCart();
      setTipoVenta("CONTADO");
      setMetodoPago("EFECTIVO");
      setMontoEfectivoMixto("");
      setFechaVencimiento("");
      setInvoiceOpen(false);
      setInvoiceCustomerName("");
      setInvoiceCustomerNit("");
      setInvoiceCustomerPhone("");
      setLastSale(sale);
      setMessage(isCorrectionMode ? "Correccion registrada. Revisa y reenvia el cierre de caja." : "Venta registrada correctamente. Ya paso a historial.");
      await loadDailySummary();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const printSale = (sale: Sale) => {
    const printWindow = window.open("", "_blank", "width=360,height=720");
    if (!printWindow) return setMessage("No se pudo abrir la ventana de impresion.");
    printWindow.document.write(buildThermalReceiptHtml(sale, user?.nombre || ""));
    printWindow.document.close();
  };

  return (
    <div className="flex min-h-full flex-col gap-4">
      {isCorrectionMode && (
        <CorrectionBanner
          dateLabel={formatInputDate(correctionDate || "")}
          reason={correctionReason}
          onReasonChange={setCorrectionReason}
          onBack={() => navigate(`/seller/historial?fecha=${correctionDate}`)}
        />
      )}

      {message && (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary-light">{message}</div>
      )}

      {dailySummary?.cerrado && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <LockKeyhole size={18} /> Caja cerrada por hoy. No se pueden registrar más ventas en esta jornada.
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
        <ProductSearchPanel
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onClearSearch={clearSearch}
          hasSearch={hasSearch}
          searching={searchingProducts}
          searchError={searchError}
          products={filteredProducts}
          cart={cart}
          isClosed={Boolean(dailySummary?.cerrado)}
          getAvailableStock={getAvailableStock}
          onAddProduct={(product) => { setMessage(null); addProduct(product); }}
        />
        <CurrentSalePanel
          cart={cart}
          subtotal={subtotal}
          discount={descuento}
          total={total}
          totalQuantity={totalQuantity}
          selectedPaymentOption={selectedPaymentOption}
          paymentMethod={metodoPago}
          saleType={tipoVenta}
          mixedCashInput={montoEfectivoMixto}
          mixedQrAmount={mixedQrAmount}
          dueDate={fechaVencimiento}
          isClosed={Boolean(dailySummary?.cerrado)}
          onClear={clearCart}
          onChangeQuantity={changeQuantity}
          onRemoveProduct={removeProduct}
          onDiscountChange={setDescuento}
          onPaymentOptionChange={selectPaymentOption}
          onMixedCashChange={(value) => {
            if (/^[0-9]*([.,][0-9]{0,2})?$/.test(value)) setMontoEfectivoMixto(value);
          }}
          onDueDateChange={setFechaVencimiento}
          onCheckout={openInvoice}
        />
      </div>

      {invoiceOpen && (
        <InvoiceModal
          cart={cart}
          customerName={invoiceCustomerName}
          customerNit={invoiceCustomerNit}
          customerPhone={invoiceCustomerPhone}
          descuento={descuento}
          metodoPago={metodoPago}
          tipoVenta={tipoVenta}
          mixedCashAmount={mixedCashAmount}
          mixedQrAmount={mixedQrAmount}
          fechaVencimiento={fechaVencimiento}
          total={total}
          subtotal={subtotal}
          totalQuantity={totalQuantity}
          saving={saving}
          onCustomerNameChange={setInvoiceCustomerName}
          onCustomerNitChange={setInvoiceCustomerNit}
          onCustomerPhoneChange={setInvoiceCustomerPhone}
          onClose={() => setInvoiceOpen(false)}
          onConfirm={handleConfirmSale}
        />
      )}

      {lastSale && (
        <SaleDetailModal sale={lastSale} onClose={() => setLastSale(null)} onPrint={() => printSale(lastSale)} />
      )}
    </div>
  );
}

function InvoiceModal({
  cart,
  customerName,
  customerNit,
  customerPhone,
  descuento,
  metodoPago,
  tipoVenta,
  mixedCashAmount,
  mixedQrAmount,
  fechaVencimiento,
  total,
  subtotal,
  totalQuantity,
  saving,
  onCustomerNameChange,
  onCustomerNitChange,
  onCustomerPhoneChange,
  onClose,
  onConfirm,
}: {
  cart: CartItem[];
  customerName: string;
  customerNit: string;
  customerPhone: string;
  descuento: number;
  metodoPago: PaymentMethod;
  tipoVenta: "CONTADO" | "CREDITO";
  mixedCashAmount: number;
  mixedQrAmount: number;
  fechaVencimiento: string;
  total: number;
  subtotal: number;
  totalQuantity: number;
  saving: boolean;
  onCustomerNameChange: (value: string) => void;
  onCustomerNitChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium">
        <div className="bg-grafito-900/80 p-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Factura de venta</h3>
            <p className="text-sm text-gray-400">{cart.length} items / {totalQuantity.toLocaleString("es-BO", { maximumFractionDigits: 2 })}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-gray-400 hover:text-white disabled:opacity-50">
            <X size={22} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Cliente / empresa" value={customerName} onChange={onCustomerNameChange} required />
            {tipoVenta === "CREDITO" && (
              <Input label="Celular" value={customerPhone} onChange={onCustomerPhoneChange} required />
            )}
            <Input label="NIT / CI" value={customerNit} onChange={onCustomerNitChange} />
          </div>

          <div className="rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-grafito-900 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-3">Codigo</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3 text-center">Cant.</th>
                  <th className="p-3 text-right">Precio</th>
                  <th className="p-3 text-right">Total linea</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {cart.map((item) => (
                  <tr key={item.product.id}>
                    <td className="p-3 font-mono text-gray-400">{item.product.codigo}</td>
                    <td className="p-3">
                      <p className="font-semibold text-white">{item.product.descripcion}</p>
                      <span className={`mt-1 inline-flex rounded border px-2 py-0.5 text-xs font-bold ${productConditionClass(item.product.condicion)}`}>
                        {productConditionLabel(item.product.condicion)}
                      </span>
                    </td>
                    <td className="p-3 text-center text-gray-300">{formatQuantity(item.cantidad, item.product)}</td>
                    <td className="p-3 text-right text-gray-300">{money(item.product.precioVenta)}</td>
                    <td className="p-3 text-right font-bold text-primary-light">{money(item.product.precioVenta * item.cantidad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
            <div className="rounded-xl border border-gray-700 bg-grafito-900/40 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Tipo" value={tipoVenta} />
                <Stat label="Metodo" value={salePaymentLabel(tipoVenta, metodoPago)} />
                {metodoPago === "MIXTO" && <Stat label="Efectivo" value={money(mixedCashAmount)} />}
                {metodoPago === "MIXTO" && <Stat label="QR" value={money(mixedQrAmount)} />}
                {tipoVenta === "CREDITO" && <Stat label="Vence" value={formatInputDate(fechaVencimiento)} />}
              </div>
            </div>
            <div className="rounded-xl border border-gray-700 bg-grafito-900/40 p-4 space-y-3">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Descuento</span>
                <span>{money(descuento)}</span>
              </div>
              <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                <span className="text-lg font-medium text-white">Total</span>
                <span className="text-3xl font-bold text-primary-light">{money(total)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 bg-grafito-900/60 p-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary disabled:opacity-50">
            Volver
          </button>
          <button type="button" onClick={onConfirm} disabled={saving} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? "Guardando..." : "Confirmar y guardar"} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SaleDetailModal({ sale, onClose, onPrint }: { sale: Sale; onClose: () => void; onPrint: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium overflow-hidden">
        <div className="bg-grafito-900/80 p-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Detalle de venta</h3>
            <p className="text-sm text-gray-400">{formatDateTime(sale.createdAt)} - {sale.cliente?.nombre || "Cliente ocasional"}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><X size={22} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Tipo" value={sale.tipoVenta} />
            <Stat label="Metodo" value={salePaymentLabel(sale.tipoVenta, sale.metodoPago)} />
            <Stat label="Subtotal" value={money(sale.subtotal)} />
            <Stat label="Descuento" value={money(sale.descuento || 0)} />
            <Stat label="Total" value={money(sale.total)} />
          </div>
          {sale.metodoPago === "MIXTO" && sale.pagos && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              {sale.pagos.map((pago) => <Stat key={pago.metodoPago} label={pago.metodoPago} value={money(pago.monto)} />)}
            </div>
          )}
          <div className="rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-grafito-900 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-3">Producto</th>
                  <th className="p-3 text-center">Cant.</th>
                  <th className="p-3 text-right">Precio</th>
                  <th className="p-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {(sale.detalles || []).map((detail) => (
                  <tr key={detail.id}>
                    <td className="p-3">
                      <p className="font-semibold text-white">{detail.producto?.descripcion || detail.descripcion || "Detalle"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-500">{detail.producto?.codigo || detail.tipoLinea || ""}</span>
                        {detail.producto && (
                          <span className={`rounded border px-2 py-0.5 font-bold ${productConditionClass(detail.producto.condicion)}`}>
                            {productConditionLabel(detail.producto.condicion)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center text-gray-300">{detail.cantidad.toLocaleString("es-BO", { maximumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right text-gray-300">{money(detail.precioUnitario)}</td>
                    <td className="p-3 text-right font-bold text-primary-light">{money(detail.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">Cerrar</button>
            <button onClick={onPrint} className="btn-primary flex items-center gap-2">
              <Printer size={18} /> Imprimir ticket 80mm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-300">{label}</span>
      <input className="premium-input" value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-grafito-900/50 p-3">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="mt-1 truncate font-bold text-white">{value}</p>
    </div>
  );
}
