import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CreditCard,
  LockKeyhole,
  Printer,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { Customer, DailySalesSummary, PaymentMethod, Product, Sale } from "../types";
import { useProducts } from "../hooks/useProducts";
import { createSale, fetchDailySalesSummary } from "../services/sales";
import { getCurrentUser } from "../services/auth";
import { createCustomer, fetchCustomers } from "../services/customers";

interface CartItem {
  product: Product;
  cantidad: number;
}

const money = (value: number) =>
  `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Ocurrio un error inesperado.";

export default function Ventas() {
  const { data: products, loading, error, refetch: refetchProducts } = useProducts();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySalesSummary | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>("EFECTIVO");
  const [tipoVenta, setTipoVenta] = useState<"CONTADO" | "CREDITO">("CONTADO");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [descuento, setDescuento] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceCustomerName, setInvoiceCustomerName] = useState("");
  const [invoiceCustomerNit, setInvoiceCustomerNit] = useState("");
  const user = getCurrentUser();

  const loadDailySummary = useCallback(async () => {
    try {
      setDailySummary(await fetchDailySalesSummary());
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchCustomers().then(setCustomers).catch((err: unknown) => setMessage(getErrorMessage(err)));
      void loadDailySummary();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDailySummary]);

  const filteredProducts = useMemo(() => {
    const search = searchTerm.toLowerCase();
    if (!search) return products.slice(0, 8);
    return products
      .filter(
        (product) =>
          product.codigo.toLowerCase().includes(search) ||
          product.descripcion.toLowerCase().includes(search) ||
          product.marca.toLowerCase().includes(search),
      )
      .slice(0, 8);
  }, [products, searchTerm]);

  const subtotal = cart.reduce((acc, item) => acc + item.product.precioVenta * item.cantidad, 0);
  const totalQuantity = cart.reduce((acc, item) => acc + item.cantidad, 0);
  const total = Math.max(subtotal - descuento, 0);

  const addToCart = (product: Product) => {
    setMessage(null);
    if (dailySummary?.cerrado) {
      setMessage("La caja de hoy ya fue cerrada. No se pueden registrar mas ventas.");
      return;
    }
    if (product.stock <= 0) {
      setMessage("Producto sin stock disponible.");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.cantidad >= product.stock) {
          setMessage(`Stock insuficiente. Disponible: ${product.stock}`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item,
        );
      }
      return [...prev, { product, cantidad: 1 }];
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const next = Math.max(1, Math.min(item.product.stock, item.cantidad + delta));
        if (next === item.cantidad && delta > 0) setMessage(`Stock insuficiente. Disponible: ${item.product.stock}`);
        return { ...item, cantidad: next };
      }),
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const openInvoice = () => {
    setMessage(null);
    if (!user) return setMessage("Debes iniciar sesion nuevamente.");
    if (cart.length === 0) return setMessage("Agrega al menos un producto.");
    if (dailySummary?.cerrado) return setMessage("La caja de hoy ya fue cerrada.");
    setInvoiceCustomerName("");
    setInvoiceCustomerNit("");
    setInvoiceOpen(true);
  };

  const resolveInvoiceCustomerId = async () => {
    const name = invoiceCustomerName.trim();
    const nit = invoiceCustomerNit.trim();

    if (!name) {
      throw new Error("Ingresa el nombre del cliente o empresa para la factura.");
    }

    const normalizedName = name.toLowerCase();
    const existing = customers.find((customer) => {
      const customerName = customer.nombre.trim().toLowerCase();
      const companyName = customer.empresa?.trim().toLowerCase();
      return customerName === normalizedName || companyName === normalizedName || (nit && customer.nit === nit);
    });

    if (existing) return existing.id;

    const created = await createCustomer({
      nombre: name,
      nit: nit || null,
      notas: "Creado desde punto de venta",
    });
    setCustomers((prev) => [created, ...prev]);
    return created.id;
  };

  const handleConfirmSale = async () => {
    setMessage(null);
    if (!user) return setMessage("Debes iniciar sesion nuevamente.");
    if (cart.length === 0) return setMessage("Agrega al menos un producto.");
    if (dailySummary?.cerrado) return setMessage("La caja de hoy ya fue cerrada.");

    setSaving(true);
    try {
      const clienteId = await resolveInvoiceCustomerId();
      const sale = await createSale({
        usuarioId: user.id,
        sucursalId: user.sucursalId,
        clienteId,
        metodoPago,
        tipoVenta,
        fechaVencimiento: tipoVenta === "CREDITO" && fechaVencimiento ? new Date(fechaVencimiento).toISOString() : null,
        descuento,
        items: cart.map((item) => ({
          productoId: item.product.id,
          cantidad: item.cantidad,
          descuentoItem: 0,
        })),
      });
      setCart([]);
      setDescuento(0);
      setTipoVenta("CONTADO");
      setFechaVencimiento("");
      setInvoiceOpen(false);
      setInvoiceCustomerName("");
      setInvoiceCustomerNit("");
      setLastSale(sale);
      setMessage("Venta registrada correctamente. Ya paso a historial.");
      await Promise.all([refetchProducts(), loadDailySummary()]);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const printSale = (sale: Sale) => {
    const printWindow = window.open("", "_blank", "width=420,height=720");
    if (!printWindow) return setMessage("No se pudo abrir la ventana de impresion.");
    const details = sale.detalles || [];
    printWindow.document.write(`
      <html>
        <head>
          <title>Detalle de venta ${sale.id}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            .muted { color: #555; font-size: 12px; }
            .row { display: flex; justify-content: space-between; gap: 12px; }
            table { border-collapse: collapse; width: 100%; margin-top: 16px; font-size: 12px; }
            th, td { border-bottom: 1px solid #ddd; padding: 8px 0; text-align: left; }
            th:last-child, td:last-child { text-align: right; }
            .totals { margin-top: 16px; border-top: 2px solid #111; padding-top: 10px; }
            .total { font-size: 18px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>El Dandy - Detalle de venta</h1>
          <div class="muted">Venta: ${sale.id}</div>
          <div class="muted">Fecha: ${formatDateTime(sale.createdAt)}</div>
          <div class="muted">Vendedor: ${sale.usuario?.nombre || user?.nombre || ""}</div>
          <div class="muted">Sucursal: ${sale.sucursal?.nombre || ""}</div>
          <div class="muted">Cliente: ${sale.cliente?.nombre || "Cliente ocasional"}</div>
          <table>
            <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
            <tbody>
              ${details
                .map(
                  (detail) => `
                <tr>
                  <td>${detail.producto?.codigo || ""} - ${detail.producto?.descripcion || "Producto"}</td>
                  <td>${detail.cantidad}</td>
                  <td>${money(detail.precioUnitario)}</td>
                  <td>${money(detail.subtotal)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          <div class="totals">
            <div class="row"><span>Metodo</span><strong>${sale.metodoPago}</strong></div>
            <div class="row"><span>Tipo</span><strong>${sale.tipoVenta}</strong></div>
            <div class="row"><span>Subtotal</span><strong>${money(sale.subtotal)}</strong></div>
            <div class="row"><span>Descuento</span><strong>${money(sale.descuento)}</strong></div>
            <div class="row total"><span>Total</span><span>${money(sale.total)}</span></div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (loading) return <div className="p-6 text-white">Cargando productos...</div>;
  if (error) return <div className="p-6 text-red-400">Error al cargar productos: {error}</div>;

  return (
    <div className="flex flex-col xl:flex-row h-full gap-6">
      <div className="flex-1 flex flex-col space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="text-primary" /> Punto de Venta
          </h2>
          <p className="text-gray-400 text-sm mt-1">Arma el carrito, revisa el detalle y emite la factura al confirmar</p>
        </div>

        {message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary-light">{message}</div>}
        {dailySummary?.cerrado && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 flex items-center gap-2">
            <LockKeyhole size={18} /> Caja cerrada por hoy. No se pueden registrar mas ventas en esta jornada.
          </div>
        )}

        <div className="glass-panel p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar repuesto por codigo, descripcion o marca..."
              className="premium-input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredProducts.map((product) => {
            const selected = cart.find((item) => item.product.id === product.id);
            return (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0 || dailySummary?.cerrado}
                className="text-left rounded-lg border border-gray-700 bg-grafito-800/70 p-3 hover:border-primary/60 disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{product.codigo} - {product.descripcion}</p>
                    <p className="text-sm text-gray-400">{product.marca} - Stock {product.stock}</p>
                    {selected && <p className="mt-1 text-xs font-semibold text-green-300">En carrito: {selected.cantidad} unidades</p>}
                  </div>
                  <span className="text-primary-light font-bold">{money(product.precioVenta)}</span>
                </div>
              </button>
            );
          })}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel flex-1 overflow-hidden flex flex-col">
          <div className="bg-grafito-800/80 p-4 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-medium text-white">Detalle de Productos</h3>
            <span className="text-sm text-gray-400">{cart.length} items / {totalQuantity} unidades</span>
          </div>
          <div className="overflow-x-auto flex-1 p-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-sm uppercase text-gray-400 border-b border-gray-700">
                  <th className="pb-3 font-medium">Codigo</th>
                  <th className="pb-3 font-medium">Descripcion</th>
                  <th className="pb-3 font-medium text-center">Cantidad</th>
                  <th className="pb-3 font-medium text-right">Precio unit.</th>
                  <th className="pb-3 font-medium text-right">Calculo</th>
                  <th className="pb-3 font-medium text-right">Total linea</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {cart.map((item) => (
                  <tr key={item.product.id}>
                    <td className="py-4 font-mono text-sm text-gray-400">{item.product.codigo}</td>
                    <td className="py-4 font-medium text-gray-200">{item.product.descripcion}</td>
                    <td className="py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => changeQuantity(item.product.id, -1)} className="w-6 h-6 rounded-md bg-grafito-600 hover:bg-grafito-500 text-white">-</button>
                        <span className="w-8 text-center text-white">{item.cantidad}</span>
                        <button onClick={() => changeQuantity(item.product.id, 1)} className="w-6 h-6 rounded-md bg-grafito-600 hover:bg-grafito-500 text-white">+</button>
                      </div>
                    </td>
                    <td className="py-4 text-right text-gray-400">{money(item.product.precioVenta)}</td>
                    <td className="py-4 text-right text-gray-400">{item.cantidad} x {money(item.product.precioVenta)}</td>
                    <td className="py-4 text-right font-medium text-primary-light">{money(item.product.precioVenta * item.cantidad)}</td>
                    <td className="py-4 text-right">
                      <button onClick={() => removeItem(item.product.id)} className="p-2 text-gray-500 hover:text-accent hover:bg-accent/10 rounded-lg">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cart.length > 0 && (
              <div className="mt-4 flex justify-end border-t border-gray-800 pt-4">
                <div className="min-w-64 rounded-xl border border-gray-700 bg-grafito-900/40 p-4">
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Cantidad total</span>
                    <span>{totalQuantity} unidades</span>
                  </div>
                  <div className="mt-2 flex justify-between text-lg font-bold text-white">
                    <span>Total carrito</span>
                    <span className="text-primary-light">{money(subtotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <aside className="w-full xl:w-[420px] flex flex-col space-y-6">
        <div className="glass-panel p-6 flex-1 flex flex-col">
          <h3 className="font-medium text-white flex items-center gap-2 mb-6">
            <Receipt className="text-gray-400" size={20} /> Resumen
          </h3>
          <div className="space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setTipoVenta("CONTADO")} className={`py-2.5 rounded-lg border font-medium ${tipoVenta === "CONTADO" ? "border-primary/50 bg-primary/10 text-primary" : "border-gray-600 bg-grafito-800 text-gray-300"}`}>Contado</button>
              <button onClick={() => setTipoVenta("CREDITO")} className={`py-2.5 rounded-lg border font-medium ${tipoVenta === "CREDITO" ? "border-primary/50 bg-primary/10 text-primary" : "border-gray-600 bg-grafito-800 text-gray-300"}`}>Credito</button>
            </div>
            {tipoVenta === "CREDITO" && (
              <label className="block text-gray-400">
                <span className="mb-1 block">Fecha vencimiento</span>
                <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="premium-input" />
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              {(["EFECTIVO", "TRANSFERENCIA", "QR", "TARJETA"] as const).map((method) => (
                <button key={method} onClick={() => setMetodoPago(method)} className={`py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${metodoPago === method ? "border-primary/50 bg-primary/10 text-primary" : "border-gray-600 bg-grafito-800 text-gray-300"}`}>
                  {method === "TARJETA" ? <CreditCard size={16} /> : null}{method}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Productos</span>
              <span>{cart.length} items / {totalQuantity} unidades</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <label className="block text-gray-400">
              <span className="mb-1 block">Descuento</span>
              <input type="number" min="0" value={descuento} onChange={(e) => setDescuento(Number(e.target.value))} className="premium-input" />
            </label>
            <div className="pt-4 border-t border-gray-700 flex justify-between items-center">
              <span className="text-lg font-medium text-white">Total</span>
              <span className="text-3xl font-bold text-primary-light">{money(total)}</span>
            </div>
          </div>
          <button onClick={openInvoice} disabled={cart.length === 0 || dailySummary?.cerrado} className="w-full btn-primary flex items-center justify-center gap-2 mt-6 text-lg disabled:opacity-60">
            Pasar a Factura <ArrowRight size={20} />
          </button>
        </div>
      </aside>

      {invoiceOpen && (
        <InvoiceModal
          cart={cart}
          customerName={invoiceCustomerName}
          customerNit={invoiceCustomerNit}
          descuento={descuento}
          metodoPago={metodoPago}
          tipoVenta={tipoVenta}
          total={total}
          subtotal={subtotal}
          totalQuantity={totalQuantity}
          saving={saving}
          onCustomerNameChange={setInvoiceCustomerName}
          onCustomerNitChange={setInvoiceCustomerNit}
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
  descuento,
  metodoPago,
  tipoVenta,
  total,
  subtotal,
  totalQuantity,
  saving,
  onCustomerNameChange,
  onCustomerNitChange,
  onClose,
  onConfirm,
}: {
  cart: CartItem[];
  customerName: string;
  customerNit: string;
  descuento: number;
  metodoPago: PaymentMethod;
  tipoVenta: "CONTADO" | "CREDITO";
  total: number;
  subtotal: number;
  totalQuantity: number;
  saving: boolean;
  onCustomerNameChange: (value: string) => void;
  onCustomerNitChange: (value: string) => void;
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
            <p className="text-sm text-gray-400">{cart.length} items / {totalQuantity} unidades</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-gray-400 hover:text-white disabled:opacity-50">
            <X size={22} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Cliente / empresa" value={customerName} onChange={onCustomerNameChange} required />
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
                    <td className="p-3 font-semibold text-white">{item.product.descripcion}</td>
                    <td className="p-3 text-center text-gray-300">{item.cantidad}</td>
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
                <Stat label="Metodo" value={metodoPago} />
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Tipo" value={sale.tipoVenta} />
            <Stat label="Metodo" value={sale.metodoPago} />
            <Stat label="Subtotal" value={money(sale.subtotal)} />
            <Stat label="Total" value={money(sale.total)} />
          </div>
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
                      <p className="font-semibold text-white">{detail.producto?.descripcion || "Producto"}</p>
                      <p className="text-xs text-gray-500">{detail.producto?.codigo}</p>
                    </td>
                    <td className="p-3 text-center text-gray-300">{detail.cantidad}</td>
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
              <Printer size={18} /> Imprimir detalle
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
