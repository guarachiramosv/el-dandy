import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CalendarDays, CircleDollarSign, CreditCard, Printer, QrCode, ReceiptText, RefreshCcw, ShoppingCart, TrendingUp, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchSucursales } from "../services/catalog";
import { fetchMonthlyProfitReport, MonthlyProfitReport } from "../services/reports";
import { Sucursal } from "../types";
import { getErrorMessage } from "../utils/errors";

const currentMonth = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
}).format(new Date());

const money = (value: number) => `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: number) => `${value.toLocaleString("es-BO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const shortMoney = (value: number) => value >= 1000 ? `Bs ${(value / 1000).toFixed(1)}k` : `Bs ${value.toFixed(0)}`;

export default function Ganancias() {
  const [month, setMonth] = useState(currentMonth);
  const [sucursalId, setSucursalId] = useState("");
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [report, setReport] = useState<MonthlyProfitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSucursales().then(setSucursales).catch(() => setSucursales([]));
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchMonthlyProfitReport({ month, sucursalId: sucursalId || undefined }));
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, "No se pudo cargar el reporte mensual."));
    } finally {
      setLoading(false);
    }
  }, [month, sucursalId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const selectedBranch = sucursales.find((branch) => branch.id === sucursalId)?.nombre || "Todas las sucursales";
  const paymentRows = useMemo(() => report ? [
    { label: "Efectivo", value: report.totals.totalEfectivo, color: "bg-emerald-500", icon: Banknote },
    { label: "QR", value: report.totals.totalQr, color: "bg-sky-500", icon: QrCode },
    { label: "Transferencia", value: report.totals.totalTransferencia, color: "bg-violet-500", icon: WalletCards },
    { label: "Tarjeta", value: report.totals.totalTarjeta, color: "bg-amber-500", icon: CreditCard },
  ] : [], [report]);
  const totalCollected = paymentRows.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="space-y-5 print:bg-white print:text-gray-950">
      <style>{`@media print { .profit-no-print { display: none !important; } .profit-panel { border: 1px solid #d1d5db !important; background: white !important; color: #111827 !important; break-inside: avoid; } .profit-panel * { color: #111827 !important; } }`}</style>

      <div className="profit-no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><TrendingUp className="text-emerald-400" /> Ganancias</h1>
          <p className="mt-1 text-sm text-gray-400">Resumen financiero mensual por sucursal.</p>
        </div>
        <button type="button" onClick={() => window.print()} disabled={!report} className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50">
          <Printer size={18} /> Imprimir
        </button>
      </div>

      <div className="profit-no-print grid gap-3 rounded-md border border-gray-800 bg-[#15171a] p-4 md:grid-cols-[220px_minmax(240px,1fr)_180px]">
        <label className="text-xs font-semibold uppercase text-gray-400">
          Mes
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="premium-input mt-2" />
        </label>
        <label className="text-xs font-semibold uppercase text-gray-400">
          Sucursal
          <select value={sucursalId} onChange={(event) => setSucursalId(event.target.value)} className="premium-input mt-2">
            <option value="">Todas las sucursales</option>
            {sucursales.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void loadReport()} disabled={loading} className="btn-primary flex h-11 items-center justify-center gap-2 self-end">
          <RefreshCcw size={17} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      {loading && !report && <div className="p-8 text-center text-gray-400">Cargando reporte...</div>}

      {report && (
        <>
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <div>
              <p className="text-sm font-semibold text-white print:text-gray-950">Periodo {report.month}</p>
              <p className="text-xs text-gray-500">{selectedBranch}</p>
            </div>
            <CalendarDays size={20} className="text-gray-500" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={CircleDollarSign} label="Ventas del mes" value={money(report.totals.totalVentas)} detail={`${report.totals.cantidadVentas} ventas`} tone="text-sky-300" />
            <Metric icon={ShoppingCart} label="Costo de productos" value={money(report.totals.costoProductos)} detail={`${report.totals.unidadesVendidas} unidades`} tone="text-amber-300" />
            <Metric icon={ReceiptText} label="Gastos" value={money(report.totals.totalGastos)} detail={`Descuentos ${money(report.totals.descuentos)}`} tone="text-red-300" />
            <Metric icon={TrendingUp} label="Ganancia neta estimada" value={money(report.totals.gananciaNeta)} detail={`Margen ${percent(report.totals.margenNeto)}`} tone={report.totals.gananciaNeta >= 0 ? "text-emerald-300" : "text-red-300"} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
            <div className="profit-panel rounded-md border border-gray-800 bg-[#15171a] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white">Resultado diario</h2>
                  <p className="text-xs text-gray-500">Ingresos y ganancia despues de costos y gastos</p>
                </div>
                <span className="text-sm font-semibold text-emerald-300">Bruta {money(report.totals.gananciaBruta)}</span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.dias} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="#2f3338" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="fecha" tickFormatter={(value) => value.slice(8)} stroke="#8b929c" fontSize={12} />
                    <YAxis tickFormatter={shortMoney} stroke="#8b929c" fontSize={11} width={64} />
                    <Tooltip contentStyle={{ background: "#15171a", border: "1px solid #3f4650", borderRadius: 6 }} formatter={(value) => money(Number(value))} labelFormatter={(value) => `Dia ${String(value).slice(8)}`} />
                    <Legend />
                    <Bar dataKey="ingresos" name="Ventas" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="ganancia" name="Ganancia" stroke="#34d399" strokeWidth={3} dot={{ r: 3 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="profit-panel rounded-md border border-gray-800 bg-[#15171a] p-4">
              <h2 className="font-semibold text-white">Dinero cobrado</h2>
              <p className="mt-1 text-xs text-gray-500">Incluye cobros de creditos del mes</p>
              <p className="mt-4 text-2xl font-bold text-white">{money(totalCollected)}</p>
              <div className="mt-5 space-y-4">
                {paymentRows.map((item) => {
                  const Icon = item.icon;
                  const share = totalCollected > 0 ? (item.value / totalCollected) * 100 : 0;
                  return (
                    <div key={item.label}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 text-gray-300"><Icon size={15} /> {item.label}</span>
                        <span className="font-semibold text-white">{money(item.value)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-gray-800"><div className={`h-full ${item.color}`} style={{ width: `${share}%` }} /></div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 border-t border-gray-800 pt-4 text-sm">
                <div className="flex justify-between text-gray-400"><span>Credito vendido</span><span className="text-white">{money(report.totals.totalCredito)}</span></div>
                <div className="mt-2 flex justify-between text-gray-400"><span>Cobros de credito</span><span className="text-white">{money(report.totals.cobrosCredito)}</span></div>
                <div className="mt-2 flex justify-between text-gray-400"><span>Ticket promedio</span><span className="text-white">{money(report.totals.ticketPromedio)}</span></div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ReportTable title="Productos y servicios con mayor ganancia" headers={["Producto", "Cantidad", "Ventas", "Ganancia"]}>
              {report.productos.map((item) => (
                <tr key={item.id} className="border-t border-gray-800">
                  <td className="p-3"><p className="font-semibold text-white">{item.descripcion}</p><p className="text-xs text-gray-500">{item.codigo || "Sin codigo"}</p></td>
                  <td className="p-3 text-right text-gray-300">{item.cantidad}</td>
                  <td className="p-3 text-right text-gray-300">{money(item.ingresos)}</td>
                  <td className={`p-3 text-right font-semibold ${item.ganancia >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(item.ganancia)}</td>
                </tr>
              ))}
              {report.productos.length === 0 && <EmptyRow columns={4} />}
            </ReportTable>

            <ReportTable title="Resultado por sucursal" headers={["Sucursal", "Ventas", "Ingresos", "Ganancia"]}>
              {report.sucursales.map((item) => (
                <tr key={item.id} className="border-t border-gray-800">
                  <td className="p-3 font-semibold text-white">{item.nombre}</td>
                  <td className="p-3 text-right text-gray-300">{item.ventas}</td>
                  <td className="p-3 text-right text-gray-300">{money(item.ingresos)}</td>
                  <td className={`p-3 text-right font-semibold ${item.ganancia >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(item.ganancia)}</td>
                </tr>
              ))}
              {report.sucursales.length === 0 && <EmptyRow columns={4} />}
            </ReportTable>
          </div>

          <p className="text-xs text-gray-500">Ganancia estimada: ventas menos costo registrado de productos y gastos de caja. Los servicios de remachado no tienen costo de mano de obra configurado.</p>
        </>
      )}
    </section>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof TrendingUp; label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="profit-panel rounded-md border border-gray-800 bg-[#15171a] p-4">
      <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold uppercase text-gray-500">{label}</p><Icon size={18} className={tone} /></div>
      <p className={`mt-3 text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function ReportTable({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) {
  return (
    <div className="profit-panel overflow-x-auto rounded-md border border-gray-800 bg-[#15171a]">
      <h2 className="border-b border-gray-800 p-4 font-semibold text-white">{title}</h2>
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-[#101214] text-xs uppercase text-gray-500"><tr>{headers.map((header, index) => <th key={header} className={`p-3 ${index > 0 ? "text-right" : "text-left"}`}>{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow({ columns }: { columns: number }) {
  return <tr><td colSpan={columns} className="p-6 text-center text-gray-500">Sin datos para este periodo.</td></tr>;
}
