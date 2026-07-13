import { useCallback, useEffect, useState } from "react";
import { Banknote, CalendarDays, LockKeyhole, Plus, Printer, ReceiptText, X } from "lucide-react";
import { CashClosing, DailySalesSummary, Sale } from "../types";
import { closeCashRegister, createCashExpense, fetchDailySalesSummary } from "../services/sales";
import { getErrorMessage } from "../utils/errors";

const money = (value: number) =>
  `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });

export default function HistorialVentas() {
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
      const data = await fetchDailySalesSummary();
      setSummary(data);
      setDeclaredCash(data.cierre?.montoDeclarado ?? data.netos?.totalEfectivo ?? data.totals.totalEfectivo);
      setCloseNotes(data.cierre?.notas || "");
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

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
      const closing = await closeCashRegister({ montoDeclarado: declaredCash, notas: closeNotes || null });
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

  const printSale = (sale: Sale) => {
    const printWindow = window.open("", "_blank", "width=420,height=720");
    if (!printWindow) return setMessage("No se pudo abrir la ventana de impresion.");
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
            .total { margin-top: 16px; border-top: 2px solid #111; padding-top: 10px; font-size: 18px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>El Dandy - Detalle de venta</h1>
          <div class="muted">Venta: ${sale.id}</div>
          <div class="muted">Fecha: ${formatDateTime(sale.createdAt)}</div>
          <div class="muted">Cliente: ${sale.cliente?.nombre || "Cliente ocasional"}</div>
          <table>
            <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
            <tbody>
              ${(sale.detalles || []).map(detail => `
                <tr>
                  <td>${detail.producto?.codigo || detail.tipoLinea || ""} - ${detail.producto?.descripcion || detail.descripcion || "Detalle"}</td>
                  <td>${detail.cantidad.toLocaleString("es-BO", { maximumFractionDigits: 2 })}</td>
                  <td>${money(detail.precioUnitario)}</td>
                  <td>${money(detail.subtotal)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="row total"><span>Total</span><span>${money(sale.total)}</span></div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <CalendarDays className="text-primary" /> Historial de ventas
        </h2>
        <p className="text-gray-400 text-sm mt-1">Ventas del dia, control de efectivo y cierre de caja.</p>
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
            {summary?.cerrado ? (
              <ClosedCashBox closing={summary.cierre} />
            ) : (
              <button
                onClick={handleCloseCash}
                disabled={closingCash}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <LockKeyhole size={18} /> {closingCash ? "Cerrando..." : "Cerrar caja por hoy"}
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedSale && (
        <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} onPrint={() => printSale(selectedSale)} />
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
                      <p className="text-xs text-gray-500">{detail.producto?.codigo || detail.tipoLinea || ""}</p>
                    </td>
                    <td className="p-3 text-center text-gray-300">{detail.cantidad.toLocaleString("es-BO", { maximumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right text-gray-300">{money(detail.precioUnitario)}</td>
                    <td className="p-3 text-right font-bold text-primary-light">{money(detail.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between border-t border-gray-700 pt-4 text-xl font-bold text-white">
            <span>Total</span>
            <span className="text-primary-light">{money(sale.total)}</span>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-grafito-900/50 p-3">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="mt-1 truncate font-bold text-white">{value}</p>
    </div>
  );
}
