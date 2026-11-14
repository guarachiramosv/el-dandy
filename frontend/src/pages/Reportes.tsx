import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Download, Printer } from "lucide-react";
import { fetchSucursales } from "../services/catalog";
import { fetchSalesHistoryReport, ReportPeriod, SalesHistoryReport } from "../services/reports";
import type { Sucursal } from "../types";

const today = new Date();
const localDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(today);
const defaultDay = localDateParts;
const defaultMonth = localDateParts.slice(0, 7);
const defaultYear = String(today.getFullYear());

import { money, businessDate, registeredAt, remainingCashAfterExpenses, remainingQrAfterExpenses, saleDetailRowsFrom, closingNotesFrom, valueForPeriod, salesReportPdfBytes } from "../utils/salesReport";

const downloadSalesReportPdf = (report: SalesHistoryReport, sucursal: string) => {
  const blob = new Blob([salesReportPdfBytes(report, sucursal)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-ventas-${report.label}-${sucursal.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function Reportes() {
  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [day, setDay] = useState(defaultDay);
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [sucursalId, setSucursalId] = useState("");
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [report, setReport] = useState<SalesHistoryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reportValue = useMemo(() => valueForPeriod(period, day, month, year), [period, day, month, year]);

  useEffect(() => {
    fetchSucursales().then(setSucursales).catch(() => setSucursales([]));
  }, []);

  const requestId = useRef(0);

  const loadReport = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSalesHistoryReport({ period, value: reportValue, sucursalId: sucursalId || undefined });
      if (currentRequest === requestId.current) {
        setReport(result);
        setLoadedAt(new Date().toISOString());
      }
      return currentRequest === requestId.current ? result : null;
    } catch (err) {
      if (currentRequest === requestId.current) {
        setReport(null);
        setError(err instanceof Error ? err.message : "No se pudo cargar el historial de ventas.");
      }
      return null;
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [period, reportValue, sucursalId]);

  const invalidateRequest = useCallback(() => { ++requestId.current; }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReport(null);
      void loadReport();
    }, 0);
    const refresh = () => {
      if (document.visibilityState === "visible") void loadReport();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      invalidateRequest();
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadReport, invalidateRequest]);

  const exportReport = async (format: 'pdf' | 'print') => {
    const latest = await loadReport();
    if (!latest) return;
    if (format === 'pdf') downloadSalesReportPdf(latest, selectedSucursal);
    else window.setTimeout(() => window.print(), 0);
  };

  const selectedSucursal = sucursales.find((item) => item.id === sucursalId)?.nombre || "Todas";
  const saleDetailRows = report ? saleDetailRowsFrom(report) : [];
  const closingNotes = report ? closingNotesFrom(report) : [];

  return (
    <section className="flex h-full flex-col gap-5 p-6 text-gray-100">
      <style>{`
        @media print {
          @page { margin: 12.7mm; size: letter landscape; }
          html, body, #root {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #111827 !important;
          }
          body * { visibility: hidden !important; }
          #sales-print, #sales-print * { visibility: visible !important; }
          #sales-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            display: block !important;
            width: 100% !important;
            box-sizing: border-box !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #111827 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 12px !important;
            line-height: 1.25 !important;
          }
          #sales-print::before { display: none !important; }
          #sales-print * {
            box-shadow: none !important;
            text-shadow: none !important;
            color: #111827 !important;
            background: transparent !important;
            font-size: 12px !important;
            line-height: 1.25 !important;
          }
          #sales-print h2, #sales-print h3, #sales-print strong, #sales-print .print-strong {
            color: #0a0a0a !important;
          }
          #sales-print h2 {
            font-size: 20px !important;
            margin: 0 0 4px 0 !important;
          }
          #sales-print h3 {
            font-size: 14px !important;
            margin: 14px 0 6px 0 !important;
          }
          #sales-print .print-muted {
            color: #4b5563 !important;
          }
          #sales-print .sales-print-header {
            display: flex !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 16px !important;
            margin-bottom: 12px !important;
            padding-bottom: 8px !important;
            border-bottom: 1px solid #d1d5db !important;
          }
          #sales-print .sales-print-meta {
            text-align: right !important;
            min-width: 180px !important;
          }
          #sales-print .sales-stats-grid {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 6px !important;
            margin: 8px 0 12px 0 !important;
          }
          #sales-print .print-card {
            border: 1px solid #d1d5db !important;
            background: #ffffff !important;
            padding: 6px 8px !important;
            border-radius: 4px !important;
          }
          #sales-print .print-card p:first-child {
            font-size: 10px !important;
            margin: 0 0 2px 0 !important;
            letter-spacing: 0 !important;
          }
          #sales-print .print-card p:last-child {
            font-size: 12px !important;
            margin: 0 !important;
          }
          #sales-print table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            margin-bottom: 10px !important;
          }
          #sales-print thead {
            display: table-header-group !important;
            background: #f3f4f6 !important;
          }
          #sales-print th {
            background: #f3f4f6 !important;
            color: #111827 !important;
            font-weight: 800 !important;
          }
          #sales-print td, #sales-print th {
            border-bottom: 1px solid #e5e7eb !important;
            padding: 5px 6px !important;
            vertical-align: top !important;
            word-break: normal !important;
            overflow-wrap: anywhere !important;
          }
          #sales-print .col-code { width: 9% !important; }
          #sales-print .col-product { width: 34% !important; }
          #sales-print .col-branch { width: 18% !important; }
          #sales-print .col-qty { width: 8% !important; }
          #sales-print .col-total { width: 12% !important; }
          #sales-print .col-date { width: 16% !important; }
          #sales-print .col-seller { width: 12% !important; }
          #sales-print .col-client { width: 18% !important; }
          #sales-print .col-payment { width: 9% !important; }
          #sales-print .col-items { width: 10% !important; }
          #sales-print .col-sale-total { width: 12% !important; }
          .no-print { display: none !important; }
          #sales-print h3 { break-after: avoid-page; page-break-after: avoid; }
          #sales-print tr { break-inside: avoid-page; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Historial de ventas</h1>
          <p className="text-sm text-gray-400">Consulta e imprime lo vendido por dia, mes o anio.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={() => void exportReport("pdf")} disabled={!report || loading} className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60">
            <Download size={18} /> Descargar PDF
          </button>
          <button onClick={() => void exportReport("print")} disabled={!report || loading} className="btn-primary flex items-center justify-center gap-2">
            <Printer size={18} /> Imprimir
          </button>
        </div>
      </div>

      <div className="no-print glass-panel grid gap-3 p-4 md:grid-cols-4 xl:grid-cols-[180px_220px_1fr_180px]">
        <select className="premium-input" value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}>
          <option value="day">Dia</option>
          <option value="month">Mes</option>
          <option value="year">Anio</option>
        </select>

        {period === "day" && <input className="premium-input" type="date" value={day} onChange={(event) => setDay(event.target.value)} />}
        {period === "month" && <input className="premium-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />}
        {period === "year" && <input className="premium-input" type="text" inputMode="numeric" maxLength={4} value={year} onChange={(event) => setYear(event.target.value)} />}

        <select className="premium-input" value={sucursalId} onChange={(event) => setSucursalId(event.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursales.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
          ))}
        </select>

        <button onClick={() => void loadReport()} disabled={loading} className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60">
          <CalendarDays size={18} /> {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {error && <div className="no-print rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">{error}</div>}

      <div id="sales-print" className="glass-panel flex-1 overflow-auto p-5 print:rounded-none print:border-0 print:p-6">
        <div className="sales-print-header mb-5 border-b border-gray-700 pb-4 print:border-gray-300">
          <div>
            <h2 className="text-2xl font-black text-white print:text-gray-950">Historial de ventas</h2>
            <p className="print-muted text-sm text-gray-400 print:text-gray-700">Reporte administrativo de ventas</p>
          </div>
          <div className="sales-print-meta">
            <p className="print-muted text-sm text-gray-400 print:text-gray-700">Periodo: {report?.label || reportValue}</p>
            <p className="print-muted text-sm text-gray-400 print:text-gray-700">Sucursal: {selectedSucursal}</p>
            <p className="print-muted text-sm text-gray-400 print:text-gray-700">Actualizado: {loadedAt ? registeredAt(loadedAt) : "Pendiente"}</p>
          </div>
        </div>

        {!report ? (
          <p className="text-gray-400">Sin datos.</p>
        ) : (
          <div className="space-y-6">
            {report.ventas.some((sale) => sale.esCorreccionCierre) && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Este reporte incluye {report.ventas.filter((sale) => sale.esCorreccionCierre).length} venta(s) agregada(s) como corrección de cierre. Los totales ya incluyen estas ventas. La fecha de registro y el motivo aparecen en el detalle.
              </div>
            )}
            <div className="sales-stats-grid grid gap-3 md:grid-cols-4">
              <Stat label="Ventas" value={String(report.totals.cantidadVentas)} />
              <Stat label="Ventas efectivo" value={money(report.totals.totalEfectivo || 0)} />
              <Stat label="Ventas QR" value={money(report.totals.totalQr || 0)} />
              <Stat label="Cobros credito" value={money(report.totals.totalCobrosCredito || 0)} />
              <Stat label="Total ventas" value={money(report.totals.totalVentas)} />
              <Stat label="Total gastos" value={money(report.totals.totalGastos || 0)} />
              <Stat label="Queda efectivo" value={money(remainingCashAfterExpenses(report))} />
              <Stat label="Queda QR" value={money(remainingQrAfterExpenses(report))} />
              <Stat label="Unidades" value={String(report.totals.unidadesVendidas)} />
              <Stat label="Descuento" value={money(report.totals.descuento)} />
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Resumen de caja</h3>
              <div className="grid gap-3 lg:grid-cols-4">
                <SummaryCard
                  label="Ventas"
                  title={`${money(report.totals.totalEfectivo || 0)} efectivo`}
                  detail={`${money(report.totals.totalQr || 0)} QR`}
                />
                <SummaryCard
                  label="Gastos"
                  title={`${money(report.totals.gastoEfectivo || 0)} efectivo`}
                  detail={`${money(report.totals.gastoQr || 0)} QR`}
                />
                <SummaryCard
                  label="Queda despues de gastos"
                  title={`${money(remainingCashAfterExpenses(report))} efectivo`}
                  detail={`${money(remainingQrAfterExpenses(report))} QR`}
                />
                <SummaryCard
                  label="Nota"
                  title={closingNotes.length > 0 ? `${closingNotes.length} cierre(s)` : "Sin cierre"}
                  detail="La nota del vendedor aparece debajo."
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Nota del vendedor al cerrar caja</h3>
              <div className="space-y-2">
                {closingNotes.length > 0 ? (
                  closingNotes.map((item, index) => (
                    <div key={`${item.seller}-${index}`} className="rounded border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100 print:border-gray-300 print:bg-gray-50 print:text-gray-800">
                      <p className="font-bold print:text-gray-950">{item.seller} / {item.branch}</p>
                      <p className="mt-1">{item.note}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded border border-gray-700 bg-grafito-900 p-3 text-sm text-gray-300 print:border-gray-300 print:bg-gray-50 print:text-gray-800">
                    Sin cierre de caja registrado para este dia.
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Detalle de ventas del vendedor</h3>
              <table className="w-full text-left text-sm">
                <thead className="bg-grafito-800 text-gray-300 print:bg-gray-100 print:text-gray-900">
                  <tr>
                    <th className="col-date p-3">Fecha de caja / registro</th>
                    <th className="col-seller p-3">Vendedor</th>
                    <th className="col-payment p-3">Pago</th>
                    <th className="col-code p-3">Codigo</th>
                    <th className="col-product p-3">Producto</th>
                    <th className="col-qty p-3 text-right">Cantidad</th>
                    <th className="col-total p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-200">
                  {saleDetailRows.map((item) => (
                    <Fragment key={item.id}>
                      <tr>
                        <td className="p-3">
                          {item.fechaNegocio ? businessDate(item.fechaNegocio) : businessDate(item.fecha)}
                          <p className="text-xs text-gray-400">Registrada: {registeredAt(item.fecha)}</p>
                          {item.correccion && <p className="text-xs text-amber-400">Corrección de cierre: {item.motivoCorreccion || "Sin motivo registrado"}</p>}
                        </td>
                        <td className="p-3">{item.vendedor}</td>
                        <td className="p-3 font-bold">{item.pago}</td>
                        <td className="p-3 font-mono">{item.codigo}</td>
                        <td className="p-3">
                          <p className="font-semibold">{item.producto}</p>
                          <p className="print-muted text-xs text-gray-500 print:text-gray-600">Precio unit.: {money(item.precioUnitario)}</p>
                        </td>
                        <td className="p-3 text-right">{item.cantidad}</td>
                        <td className="p-3 text-right">{money(item.subtotal)}</td>
                      </tr>
                      {item.isLast && (
                        <tr className="bg-gray-900/70 font-semibold print:bg-gray-100">
                          <td colSpan={7} className="p-3 text-right">
                            Subtotal: {money(item.saleSubtotal)} · Descuento: {money(item.saleDiscount)} · Total cobrado: {money(item.saleTotal)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {saleDetailRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-500">Sin ventas en este periodo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Gastos registrados</h3>
              <table className="w-full text-left text-sm">
                <thead className="bg-grafito-800 text-gray-300 print:bg-gray-100 print:text-gray-900">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Vendedor</th>
                    <th className="p-3">Detalle del gasto</th>
                    <th className="p-3">Pago</th>
                    <th className="p-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-200">
                  {(report.gastos || []).map((expense) => (
                    <tr key={expense.id}>
                      <td className="p-3">{businessDate(expense.fechaNegocio || expense.createdAt)}<p className="text-xs text-gray-400">Registrado: {registeredAt(expense.createdAt)}</p></td>
                      <td className="p-3">{expense.usuario?.nombre || "Usuario"}</td>
                      <td className="p-3">
                        <p className="font-semibold">{expense.motivo}</p>
                        {expense.notas && <p className="print-muted text-xs text-gray-500 print:text-gray-600">{expense.notas}</p>}
                      </td>
                      <td className="p-3">{expense.metodoPago}</td>
                      <td className="p-3 text-right font-bold">{money(expense.monto)}</td>
                    </tr>
                  ))}
                  {(report.gastos || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-500">Sin gastos en este periodo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>
    </section>
  );
}

function SummaryCard({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div className="print-card rounded-lg border border-gray-700 bg-grafito-900 p-4 print:border-gray-300 print:bg-white">
      <p className="print-muted text-xs uppercase text-gray-500 print:text-gray-600">{label}</p>
      <p className="print-strong mt-1 text-lg font-black text-white print:text-gray-950">{title}</p>
      <p className="print-muted mt-1 text-sm text-gray-400 print:text-gray-700">{detail}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-card rounded-lg border border-gray-700 bg-grafito-900 p-3 print:border-gray-300 print:bg-white">
      <p className="print-muted text-xs uppercase text-gray-500 print:text-gray-600">{label}</p>
      <p className="print-strong mt-1 text-xl font-black text-white print:text-gray-950">{value}</p>
    </div>
  );
}
