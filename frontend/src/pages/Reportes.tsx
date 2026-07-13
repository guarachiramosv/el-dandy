import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Printer } from "lucide-react";
import { fetchSucursales } from "../services/catalog";
import { fetchSalesHistoryReport, ReportPeriod, SalesHistoryReport } from "../services/reports";
import type { Sucursal } from "../types";

const today = new Date();
const defaultDay = today.toISOString().slice(0, 10);
const defaultMonth = today.toISOString().slice(0, 7);
const defaultYear = String(today.getFullYear());

const money = (value: number) => `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function valueForPeriod(period: ReportPeriod, day: string, month: string, year: string) {
  if (period === "year") return year;
  if (period === "month") return month;
  return day;
}

export default function Reportes() {
  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [day, setDay] = useState(defaultDay);
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [sucursalId, setSucursalId] = useState("");
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [report, setReport] = useState<SalesHistoryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportValue = useMemo(() => valueForPeriod(period, day, month, year), [period, day, month, year]);

  useEffect(() => {
    fetchSucursales().then(setSucursales).catch(() => setSucursales([]));
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchSalesHistoryReport({ period, value: reportValue, sucursalId: sucursalId || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial de ventas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReport();
    }, 0);
    return () => window.clearTimeout(timer);
    // Carga inicial con filtros por defecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSucursal = sucursales.find((item) => item.id === sucursalId)?.nombre || "Todas";

  return (
    <section className="flex h-full flex-col gap-5 p-6 text-gray-100">
      <style>{`
        @media print {
          @page { margin: 10mm; size: A4 landscape; }
          html, body, #root {
            width: 100% !important;
            height: auto !important;
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
          #sales-print .col-code { width: 12% !important; }
          #sales-print .col-product { width: 34% !important; }
          #sales-print .col-branch { width: 20% !important; }
          #sales-print .col-qty { width: 14% !important; }
          #sales-print .col-total { width: 20% !important; }
          #sales-print .col-date { width: 22% !important; }
          #sales-print .col-seller { width: 18% !important; }
          #sales-print .col-client { width: 18% !important; }
          #sales-print .col-payment { width: 20% !important; }
          #sales-print .col-items { width: 10% !important; }
          #sales-print .col-sale-total { width: 12% !important; }
          .no-print { display: none !important; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Historial de ventas</h1>
          <p className="text-sm text-gray-400">Consulta e imprime lo vendido por dia, mes o anio.</p>
        </div>
        <button onClick={() => window.print()} className="btn-primary flex items-center justify-center gap-2">
          <Printer size={18} /> Imprimir
        </button>
      </div>

      <div className="no-print glass-panel grid gap-3 p-4 md:grid-cols-4 xl:grid-cols-[180px_220px_1fr_180px]">
        <select className="premium-input" value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}>
          <option value="day">Dia</option>
          <option value="month">Mes</option>
          <option value="year">Anio</option>
        </select>

        {period === "day" && <input className="premium-input" type="date" value={day} onChange={(event) => setDay(event.target.value)} />}
        {period === "month" && <input className="premium-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />}
        {period === "year" && <input className="premium-input" type="number" min="2020" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />}

        <select className="premium-input" value={sucursalId} onChange={(event) => setSucursalId(event.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursales.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
          ))}
        </select>

        <button onClick={loadReport} disabled={loading} className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60">
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
            <p className="print-muted text-sm text-gray-400 print:text-gray-700">Generado: {new Date().toLocaleString("es-BO")}</p>
          </div>
        </div>

        {!report ? (
          <p className="text-gray-400">Sin datos.</p>
        ) : (
          <div className="space-y-6">
            <div className="sales-stats-grid grid gap-3 md:grid-cols-4">
              <Stat label="Ventas" value={String(report.totals.cantidadVentas)} />
              <Stat label="Total" value={money(report.totals.totalVentas)} />
              <Stat label="Gastos" value={money(report.totals.totalGastos || 0)} />
              <Stat label="Disponible" value={money(report.totals.totalDisponible ?? report.totals.totalVentas)} />
              <Stat label="Efectivo neto" value={money(report.totals.netoEfectivo ?? report.totals.totalEfectivo)} />
              <Stat label="QR neto" value={money(report.totals.netoQr ?? report.totals.totalQr)} />
              <Stat label="Unidades" value={String(report.totals.unidadesVendidas)} />
              <Stat label="Descuento" value={money(report.totals.descuento)} />
              <Stat label="Items" value={String(report.totals.cantidadItems)} />
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Productos vendidos</h3>
              <table className="w-full text-left text-sm">
                <thead className="bg-grafito-800 text-gray-300 print:bg-gray-100 print:text-gray-900">
                  <tr>
                    <th className="col-code p-3">Codigo</th>
                    <th className="col-product p-3">Producto</th>
                    <th className="col-branch p-3">Sucursal</th>
                    <th className="col-qty p-3 text-right">Cantidad</th>
                    <th className="col-total p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-200">
                  {report.productosVendidos.map((item) => (
                    <tr key={item.productoId}>
                      <td className="p-3 font-mono">{item.codigo}</td>
                      <td className="p-3">
                        <p className="font-semibold">{item.descripcion}</p>
                        <p className="print-muted text-xs text-gray-500 print:text-gray-600">{item.marca} - {item.categoria}</p>
                      </td>
                      <td className="p-3">{item.sucursal}</td>
                      <td className="p-3 text-right">{item.cantidad}</td>
                      <td className="p-3 text-right">{money(item.total)}</td>
                    </tr>
                  ))}
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
                    <th className="p-3">Sucursal</th>
                    <th className="p-3">Motivo</th>
                    <th className="p-3">Origen</th>
                    <th className="p-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-200">
                  {(report.gastos || []).map((expense) => (
                    <tr key={expense.id}>
                      <td className="p-3">{new Date(expense.createdAt).toLocaleString("es-BO")}</td>
                      <td className="p-3">{expense.usuario?.nombre || "Usuario"}</td>
                      <td className="p-3">{expense.sucursal?.nombre || "Sucursal"}</td>
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
                      <td colSpan={6} className="p-4 text-center text-gray-500">Sin gastos en este periodo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Ventas registradas</h3>
              <table className="w-full text-left text-sm">
                <thead className="bg-grafito-800 text-gray-300 print:bg-gray-100 print:text-gray-900">
                  <tr>
                    <th className="col-date p-3">Fecha</th>
                    <th className="col-seller p-3">Vendedor</th>
                    <th className="col-client p-3">Cliente</th>
                    <th className="col-payment p-3">Pago</th>
                    <th className="col-items p-3 text-right">Items</th>
                    <th className="col-sale-total p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-200">
                  {report.ventas.map((sale) => (
                    <tr key={sale.id}>
                      <td className="p-3">{new Date(sale.createdAt).toLocaleString("es-BO")}</td>
                      <td className="p-3">{sale.usuario?.nombre || "Usuario"}</td>
                      <td className="p-3">{sale.cliente?.nombre || "Sin cliente"}</td>
                      <td className="p-3">{sale.tipoVenta} / {sale.metodoPago}</td>
                      <td className="p-3 text-right">{sale.detalles?.length || 0}</td>
                      <td className="p-3 text-right font-bold">{money(sale.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
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
