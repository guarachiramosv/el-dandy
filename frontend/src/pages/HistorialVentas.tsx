import { useCallback, useEffect, useState } from "react";
import { Banknote, CalendarDays, LockKeyhole, Plus, Printer, ReceiptText, X } from "lucide-react";
import { CashClosing, DailySalesSummary, Sale } from "../types";
import { getCurrentUser } from "../services/auth";
import { closeCashRegister, createCashExpense, fetchDailySalesSummary, updateSalePaymentMethod } from "../services/sales";
import { getErrorMessage } from "../utils/errors";
import { buildThermalCashClosingHtml, buildThermalReceiptHtml } from "../utils/thermalReceipt";

const money = (value: number) =>
  `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });

const defaultDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const productConditionLabel = (condition?: string | null) => condition === "USADO" ? "Usado" : "Nuevo";
const productConditionClass = (condition?: string | null) =>
  condition === "USADO"
    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
    : "border-green-500/40 bg-green-500/10 text-green-200";

export default function HistorialVentas() {
  const user = getCurrentUser();
  const [reportDate, setReportDate] = useState(defaultDay);
  const [summary, setSummary] = useState<DailySalesSummary | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [declaredCash, setDeclaredCash] = useState(0);
  const [closeNotes, setCloseNotes] = useState("");
  const [expenseReason, setExpenseReason] = useState("");
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseMethod, setExpenseMethod] = useState<"EFECTIVO" | "QR">("EFECTIVO");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [closingCash, setClosingCash] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDailySalesSummary(reportDate);
      setSummary(data);
      setDeclaredCash(data.cierre?.montoDeclarado ?? data.netos?.totalEfectivo ?? data.totals.totalEfectivo);
      setCloseNotes(data.cierre?.notas || "");
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [reportDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSummary();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  const handleCloseCash = async () => {
    setMessage(null);
    setClosingCash(true);
    try {
      const closing = await closeCashRegister({ fecha: reportDate, montoDeclarado: declaredCash, notas: closeNotes || null });
      setMessage(`Caja cerrada correctamente. Diferencia: ${money(closing.diferencia)}.`);
      await loadSummary();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setClosingCash(false);
    }
  };

  const handleAddExpense = async () => {
    setMessage(null);
    const motivo = expenseReason.trim();
    if (!motivo) return setMessage("Indica para que se saco dinero.");
    if (expenseAmount <= 0) return setMessage("Ingresa un monto de gasto mayor a cero.");
    if (summary?.cerrado) return setMessage("La caja de hoy ya fue cerrada.");

    setSavingExpense(true);
    try {
      await createCashExpense({
        motivo,
        monto: expenseAmount,
        metodoPago: expenseMethod,
        notas: expenseNotes.trim() || null,
      });
      setExpenseReason("");
      setExpenseAmount(0);
      setExpenseMethod("EFECTIVO");
      setExpenseNotes("");
      setMessage("Gasto registrado correctamente.");
      await loadSummary();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setSavingExpense(false);
    }
  };

  const fillBankDepositNote = () => {
    const amount = money(expectedCash);
    setDeclaredCash(expectedCash);
    setCloseNotes(`Efectivo neto del dia (${amount}) entregado para deposito al banco. Ya no queda efectivo de ventas en caja.`);
  };

  const printCashClosing = () => {
    if (!summary) return;
    if (!summary.cerrado || !summary.cierre) {
      return setMessage("Primero cierra caja para imprimir el reporte con el monto real cerrado.");
    }
    const printWindow = window.open("", "_blank", "width=360,height=720");
    if (!printWindow) return setMessage("No se pudo abrir la ventana de impresion.");
    printWindow.document.write(buildThermalCashClosingHtml(summary, user?.nombre || "", {
      declaredCash,
      notes: closeNotes || null,
    }));
    printWindow.document.close();
  };

  const printSale = (sale: Sale) => {
    const printWindow = window.open("", "_blank", "width=360,height=720");
    if (!printWindow) return setMessage("No se pudo abrir la ventana de impresion.");
    printWindow.document.write(buildThermalReceiptHtml(sale, user?.nombre || ""));
    printWindow.document.close();
  };

  const grossCash = summary?.totals.totalEfectivo || 0;
  const grossQr = summary?.totals.totalQr || 0;
  const expenseTotals = summary?.gastos?.totals || { totalGastos: 0, totalEfectivo: 0, totalQr: 0 };
  const expectedCash = summary?.netos?.totalEfectivo ?? Math.max(grossCash - expenseTotals.totalEfectivo, 0);
  const expectedQr = summary?.netos?.totalQr ?? Math.max(grossQr - expenseTotals.totalQr, 0);
  const difference = declaredCash - expectedCash;

  if (loading) return <div className="p-6 text-white">Cargando historial...</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <CalendarDays className="text-primary" /> Historial de ventas
            </h2>
            <p className="text-gray-400 text-sm mt-1">Ventas del dia, control de efectivo y cierre de caja.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
              className="premium-input h-11"
            />
            <button onClick={loadSummary} disabled={loading} className="btn-secondary h-11 disabled:opacity-60">
              {loading ? "Cargando..." : "Actualizar dia"}
            </button>
          </div>
        </div>
      </div>

      {message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary-light">{message}</div>}

      <div className="glass-panel overflow-hidden">
        <div className="bg-grafito-800/80 p-4 border-b border-gray-700 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-medium text-white">Historial vendido de hoy</h3>
            <p className="text-sm text-gray-400">
              {summary?.fecha || "Hoy"} - {summary?.totals.cantidadVentas || 0} ventas registradas
            </p>
          </div>
          {summary?.cerrado && (
            <span className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-semibold text-green-200">
              Caja cerrada
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 p-4 border-b border-gray-800">
          <Stat label="Total" value={money(summary?.totals.totalVentas || 0)} />
          <Stat label="Efectivo" value={money(summary?.totals.totalEfectivo || 0)} />
          <Stat label="Transferencia" value={money(summary?.totals.totalTransferencia || 0)} />
          <Stat label="QR" value={money(summary?.totals.totalQr || 0)} />
          <Stat label="Tarjeta" value={money(summary?.totals.totalTarjeta || 0)} />
          <Stat label="Credito" value={money(summary?.totals.totalCredito || 0)} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 p-4">
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-grafito-900 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Hora</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Pago</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-sm">
                  {(summary?.ventas || []).map((sale) => (
                    <tr key={sale.id} className="hover:bg-grafito-800/50">
                      <td className="p-3 text-gray-400">{formatDateTime(sale.createdAt)}</td>
                      <td className="p-3 text-white">{sale.cliente?.nombre || "Cliente ocasional"}</td>
                      <td className="p-3 text-gray-300">{sale.tipoVenta === "CREDITO" ? "CREDITO" : sale.metodoPago}</td>
                      <td className="p-3 text-right font-bold text-primary-light">{money(sale.total)}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => setSelectedSale(sale)} className="text-gray-300 hover:text-white">
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(summary?.ventas || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-500">Aun no hay ventas hoy.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-gray-800 bg-grafito-900/40 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <ReceiptText size={18} className="text-amber-300" /> Gastos del dia
                </h4>
                <span className="text-sm font-semibold text-amber-200">{money(expenseTotals.totalGastos)}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_140px_140px]">
                <input
                  type="text"
                  value={expenseReason}
                  onChange={(event) => setExpenseReason(event.target.value)}
                  disabled={summary?.cerrado}
                  placeholder="Para que se saco dinero..."
                  className="premium-input"
                />
                <input
                  type="number"
                  min="0"
                  value={expenseAmount}
                  onChange={(event) => setExpenseAmount(Number(event.target.value))}
                  disabled={summary?.cerrado}
                  className="premium-input"
                />
                <select
                  value={expenseMethod}
                  onChange={(event) => setExpenseMethod(event.target.value as "EFECTIVO" | "QR")}
                  disabled={summary?.cerrado}
                  className="premium-input"
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="QR">QR</option>
                </select>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px]">
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(event) => setExpenseNotes(event.target.value)}
                  disabled={summary?.cerrado}
                  placeholder="Nota opcional"
                  className="premium-input"
                />
                <button
                  onClick={handleAddExpense}
                  disabled={savingExpense || summary?.cerrado}
                  className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Plus size={18} /> {savingExpense ? "Guardando..." : "Agregar gasto"}
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-gray-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-grafito-900 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="p-3">Hora</th>
                      <th className="p-3">Motivo</th>
                      <th className="p-3">Origen</th>
                      <th className="p-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(summary?.gastos?.items || []).map((expense) => (
                      <tr key={expense.id}>
                        <td className="p-3 text-gray-400">{formatDateTime(expense.createdAt)}</td>
                        <td className="p-3 text-white">
                          <p className="font-semibold">{expense.motivo}</p>
                          {expense.notas && <p className="text-xs text-gray-500">{expense.notas}</p>}
                        </td>
                        <td className="p-3 text-gray-300">{expense.metodoPago}</td>
                        <td className="p-3 text-right font-bold text-amber-200">{money(expense.monto)}</td>
                      </tr>
                    ))}
                    {(summary?.gastos?.items || []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-gray-500">Sin gastos registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-grafito-900/40 p-4 space-y-3">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Banknote size={18} className="text-green-300" /> Cierre de caja
            </h4>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Ventas efectivo</span>
              <span className="font-semibold text-white">{money(grossCash)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Gastos efectivo</span>
              <span className="font-semibold text-amber-200">-{money(expenseTotals.totalEfectivo)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-800 pt-3 text-sm text-gray-400">
              <span>Efectivo esperado</span>
              <span className="font-semibold text-green-200">{money(expectedCash)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>QR neto</span>
              <span className="font-semibold text-blue-200">{money(expectedQr)}</span>
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">
              Si el efectivo se deposita al banco al cerrar, cuenta el dinero en caja, deja ese monto en el cierre y registra la nota de deposito.
            </div>
            <label className="block text-sm text-gray-300">
              <span className="mb-1 block">Dinero contado en caja</span>
              <input
                type="number"
                min="0"
                value={declaredCash}
                onChange={(event) => setDeclaredCash(Number(event.target.value))}
                disabled={summary?.cerrado}
                className="premium-input"
              />
            </label>
            <div className={`rounded-lg border p-3 text-sm ${
              difference === 0
                ? "border-green-500/30 bg-green-500/10 text-green-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}>
              Diferencia: {money(difference)}
            </div>
            <label className="block text-sm text-gray-300">
              <span className="mb-1 block">Notas</span>
              <textarea
                value={closeNotes}
                onChange={(event) => setCloseNotes(event.target.value)}
                disabled={summary?.cerrado}
                className="premium-input min-h-20"
              />
            </label>
            {!summary?.cerrado && (
              <button
                type="button"
                onClick={fillBankDepositNote}
                className="btn-secondary w-full"
              >
                Marcar efectivo para deposito al banco
              </button>
            )}
            {summary?.cerrado ? (
              <>
                <ClosedCashBox closing={summary.cierre} />
                <button
                  type="button"
                  onClick={printCashClosing}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Printer size={18} /> Imprimir cierre 80mm
                </button>
              </>
            ) : (
              <div className="grid gap-2">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  Cierra caja para habilitar la impresion del reporte real de ese dia.
                </div>
                <button
                  onClick={handleCloseCash}
                  disabled={closingCash}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <LockKeyhole size={18} /> {closingCash ? "Cerrando..." : "Cerrar caja por hoy"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedSale && (
        <SaleDetailModal 
          sale={selectedSale} 
          onClose={() => setSelectedSale(null)} 
          onPrint={() => printSale(selectedSale)} 
          onPaymentUpdated={(newMethod) => {
            setSelectedSale({ ...selectedSale, metodoPago: newMethod });
            loadSummary();
          }} 
        />
      )}
    </div>
  );
}

function ClosedCashBox({ closing }: { closing?: CashClosing | null }) {
  return (
    <div className="space-y-1 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200">
      <p>Cerrado con {money(closing?.montoDeclarado || 0)} en caja.</p>
      <p>Efectivo neto esperado {money(closing?.netoEfectivo ?? closing?.totalEfectivo ?? 0)}.</p>
      <p>Gastos descontados {money(closing?.totalGastos || 0)}. Diferencia {money(closing?.diferencia || 0)}.</p>
    </div>
  );
}

function SaleDetailModal({ sale, onClose, onPrint, onPaymentUpdated }: { sale: Sale; onClose: () => void; onPrint: () => void; onPaymentUpdated: (method: "EFECTIVO" | "QR") => void }) {
  const [updating, setUpdating] = useState(false);
  const [confirmMethod, setConfirmMethod] = useState<"EFECTIVO" | "QR" | null>(null);

  const handleUpdatePayment = async (newMethod: "EFECTIVO" | "QR") => {
    setUpdating(true);
    try {
      await updateSalePaymentMethod(sale.id, newMethod);
      onPaymentUpdated(newMethod);
      setConfirmMethod(null);
    } catch (error) {
      alert(getErrorMessage(error));
      setConfirmMethod(null);
    } finally {
      setUpdating(false);
    }
  };

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
          <div className="space-y-2 border-t border-gray-700 pt-4">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span>{money(sale.subtotal || 0)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Descuento</span>
              <span>{money(sale.descuento || 0)}</span>
            </div>
            <div className="flex justify-between pt-2 text-xl font-bold text-white">
              <span>Total</span>
              <span className="text-primary-light">{money(sale.total)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-gray-700 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Pago actual: <strong className="text-white">{sale.metodoPago}</strong></span>
              {sale.metodoPago === "EFECTIVO" ? (
                <button onClick={() => setConfirmMethod("QR")} disabled={updating} className="btn-secondary py-1 px-2 text-xs">Cambiar a QR</button>
              ) : sale.metodoPago === "QR" ? (
                <button onClick={() => setConfirmMethod("EFECTIVO")} disabled={updating} className="btn-secondary py-1 px-2 text-xs">Cambiar a Efectivo</button>
              ) : null}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary">Cerrar</button>
              <button onClick={onPrint} className="btn-primary flex items-center gap-2">
                <Printer size={18} /> Imprimir detalle
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmMethod && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmMethod(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium p-6 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Confirmar cambio</h3>
            <p className="text-gray-300 mb-6">
              ¿Seguro que deseas cambiar el método de pago a <strong className="text-white">{confirmMethod}</strong>?
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmMethod(null)} className="btn-secondary w-full" disabled={updating}>Cancelar</button>
              <button onClick={() => handleUpdatePayment(confirmMethod)} className="btn-primary w-full" disabled={updating}>
                {updating ? "Guardando..." : "Sí, cambiar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
