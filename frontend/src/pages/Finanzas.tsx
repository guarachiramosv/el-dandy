import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Banknote, Building2, CheckCircle2, Landmark, Plus, RefreshCcw, Save, ShieldCheck, ShoppingCart, Trash2, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { fetchSucursales } from "../services/catalog";
import { createFinancialMovement, deleteFinancialMovement, fetchFinanceSummary, FinanceSummary, FinancialCategory, saveMonthlyBalance } from "../services/finances";
import { Sucursal } from "../types";
import { getErrorMessage } from "../utils/errors";

const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit" }).format(new Date());
const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = (value: number) => `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: number) => `${value.toLocaleString("es-BO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const categoryLabels: Record<FinancialCategory, string> = {
  GASTO_NEGOCIO: "Gasto del negocio",
  RETIRO_PERSONAL: "Retiro personal",
  APORTE_PROPIETARIO: "Aporte del propietario",
};

export default function Finanzas() {
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [movement, setMovement] = useState({ categoria: "GASTO_NEGOCIO" as FinancialCategory, descripcion: "", monto: "", fecha: currentDate, sucursalId: "", notas: "" });
  const [balance, setBalance] = useState({ saldoInicial: "0", saldoReal: "" });

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFinanceSummary(month);
      setSummary(data);
      setBalance({ saldoInicial: String(data.cuenta.saldoInicial), saldoReal: data.cuenta.saldoReal === null ? "" : String(data.cuenta.saldoReal) });
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, "No se pudo cargar la informacion financiera."));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchSucursales().then(setSucursales).catch(() => setSucursales([]));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSummary(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  const submitMovement = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(movement.monto);
    if (!movement.descripcion.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Completa la descripcion e ingresa un monto mayor a cero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createFinancialMovement({ ...movement, descripcion: movement.descripcion.trim(), monto: amount, sucursalId: movement.sucursalId || null, notas: movement.notas.trim() || null });
      setMovement((current) => ({ ...current, descripcion: "", monto: "", notas: "" }));
      setMessage("Movimiento registrado correctamente.");
      await loadSummary();
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, "No se pudo registrar el movimiento."));
    } finally {
      setSaving(false);
    }
  };

  const submitBalance = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveMonthlyBalance({ mes: month, saldoInicial: Number(balance.saldoInicial || 0), saldoReal: balance.saldoReal === "" ? null : Number(balance.saldoReal) });
      setMessage("Saldo bancario actualizado.");
      await loadSummary();
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, "No se pudo guardar el saldo."));
    } finally {
      setSaving(false);
    }
  };

  const removeMovement = async (id: string) => {
    if (!window.confirm("Eliminar este movimiento financiero?")) return;
    setSaving(true);
    try {
      await deleteFinancialMovement(id);
      setMessage("Movimiento eliminado.");
      await loadSummary();
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, "No se pudo eliminar el movimiento."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Landmark className="text-sky-400" /> Finanzas</h1>
            <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200"><ShieldCheck size={14} /> Solo administrador</span>
          </div>
          <p className="mt-1 text-sm text-gray-400">Ganancia real del negocio y dinero esperado en la cuenta del propietario.</p>
        </div>
        <div className="flex gap-2">
          <input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setMessage(null); }} className="premium-input w-44" />
          <button type="button" onClick={() => void loadSummary()} disabled={loading} title="Actualizar" className="btn-secondary flex h-11 w-11 items-center justify-center px-0"><RefreshCcw size={18} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      {message && <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div>}
      {loading && !summary && <div className="p-8 text-center text-gray-400">Cargando finanzas...</div>}

      {summary && (
        <>
          <BusinessStatus summary={summary} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={TrendingUp} label="Ventas del mes" value={money(summary.rentabilidad.totalVentas)} detail={`${summary.rentabilidad.cantidadVentas} ventas`} tone="text-sky-300" />
            <Metric icon={Banknote} label="Ganancia neta" value={money(summary.rentabilidad.gananciaNeta)} detail={`Margen ${percent(summary.rentabilidad.margenNeto)}`} tone={summary.rentabilidad.gananciaNeta >= 0 ? "text-emerald-300" : "text-red-300"} />
            <Metric icon={Landmark} label="Saldo esperado" value={money(summary.cuenta.saldoEsperado)} detail={`Inicial ${money(summary.cuenta.saldoInicial)}`} tone="text-amber-300" />
            <Metric icon={ShoppingCart} label="Compra de mercaderia" value={money(summary.flujo.comprasMercaderia)} detail="Reduce banco, aumenta inventario" tone="text-violet-300" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
            <div className="rounded-md border border-gray-800 bg-[#15171a]">
              <div className="border-b border-gray-800 p-4">
                <h2 className="font-semibold text-white">Como se calcula el saldo esperado</h2>
                <p className="mt-1 text-xs text-gray-500">Ingresos bancarios menos compras, gastos y retiros del mes.</p>
              </div>
              <div className="divide-y divide-gray-800 text-sm">
                <FlowRow icon={WalletCards} label="Saldo inicial" value={summary.cuenta.saldoInicial} />
                <FlowRow icon={ArrowUpCircle} label="Depositos de cierres de caja" value={summary.flujo.depositosEfectivo} positive />
                <FlowRow icon={ArrowUpCircle} label="QR, transferencias, tarjetas y cobros" value={summary.cuenta.ingresosBanco - summary.flujo.depositosEfectivo - summary.flujo.aportesPropietario} positive />
                <FlowRow icon={ArrowUpCircle} label="Aportes del propietario" value={summary.flujo.aportesPropietario} positive />
                <FlowRow icon={ShoppingCart} label="Compras de mercaderia" value={summary.flujo.comprasMercaderia} negative />
                <FlowRow icon={ArrowDownCircle} label="Gastos del negocio" value={summary.flujo.gastosAdministrador + summary.flujo.gastosCajaQr} negative />
                <FlowRow icon={TrendingDown} label="Retiros personales" value={summary.flujo.retirosPersonales} negative />
              </div>
              <div className="flex items-center justify-between border-t border-gray-700 bg-[#101214] p-4">
                <span className="font-semibold text-white">Debe haber en la cuenta</span>
                <span className="text-xl font-bold text-amber-300">{money(summary.cuenta.saldoEsperado)}</span>
              </div>
            </div>

            <form onSubmit={submitBalance} className="rounded-md border border-gray-800 bg-[#15171a] p-4">
              <h2 className="flex items-center gap-2 font-semibold text-white"><Landmark size={18} /> Control bancario</h2>
              <p className="mt-1 text-xs text-gray-500">Registra el saldo al comenzar el mes y, cuando quieras comparar, el saldo que muestra el banco.</p>
              <label className="mt-5 block text-xs font-semibold uppercase text-gray-400">Saldo inicial<input type="number" min="0" step="0.01" value={balance.saldoInicial} onChange={(event) => setBalance((current) => ({ ...current, saldoInicial: event.target.value }))} className="premium-input mt-2" /></label>
              <label className="mt-4 block text-xs font-semibold uppercase text-gray-400">Saldo real actual<input type="number" min="0" step="0.01" value={balance.saldoReal} onChange={(event) => setBalance((current) => ({ ...current, saldoReal: event.target.value }))} placeholder="Opcional" className="premium-input mt-2" /></label>
              {summary.cuenta.diferenciaBanco !== null && (
                <div className={`mt-4 rounded-md border p-3 text-sm ${Math.abs(summary.cuenta.diferenciaBanco) < 0.01 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"}`}>
                  Diferencia con el banco: <strong>{money(summary.cuenta.diferenciaBanco)}</strong>
                </div>
              )}
              <button type="submit" disabled={saving} className="btn-primary mt-5 flex w-full items-center justify-center gap-2"><Save size={17} /> Guardar saldos</button>
            </form>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(330px,0.65fr)_minmax(0,1.35fr)]">
            <form onSubmit={submitMovement} className="rounded-md border border-gray-800 bg-[#15171a] p-4">
              <h2 className="flex items-center gap-2 font-semibold text-white"><Plus size={18} /> Registrar movimiento</h2>
              <div className="mt-4 space-y-4">
                <label className="block text-xs font-semibold uppercase text-gray-400">Tipo<select value={movement.categoria} onChange={(event) => setMovement((current) => ({ ...current, categoria: event.target.value as FinancialCategory }))} className="premium-input mt-2"><option value="GASTO_NEGOCIO">Gasto del negocio</option><option value="RETIRO_PERSONAL">Retiro personal</option><option value="APORTE_PROPIETARIO">Aporte del propietario</option></select></label>
                <label className="block text-xs font-semibold uppercase text-gray-400">Descripcion<input value={movement.descripcion} onChange={(event) => setMovement((current) => ({ ...current, descripcion: event.target.value }))} placeholder="Ej. Pago de alquiler" className="premium-input mt-2" /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold uppercase text-gray-400">Monto<input type="number" min="0.01" step="0.01" value={movement.monto} onChange={(event) => setMovement((current) => ({ ...current, monto: event.target.value }))} className="premium-input mt-2" /></label>
                  <label className="block text-xs font-semibold uppercase text-gray-400">Fecha<input type="date" value={movement.fecha} onChange={(event) => setMovement((current) => ({ ...current, fecha: event.target.value }))} className="premium-input mt-2" /></label>
                </div>
                <label className="block text-xs font-semibold uppercase text-gray-400">Sucursal<select value={movement.sucursalId} onChange={(event) => setMovement((current) => ({ ...current, sucursalId: event.target.value }))} className="premium-input mt-2"><option value="">General</option>{sucursales.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}</select></label>
                <label className="block text-xs font-semibold uppercase text-gray-400">Notas<input value={movement.notas} onChange={(event) => setMovement((current) => ({ ...current, notas: event.target.value }))} placeholder="Opcional" className="premium-input mt-2" /></label>
              </div>
              <button type="submit" disabled={saving} className="btn-primary mt-5 flex w-full items-center justify-center gap-2"><Plus size={17} /> Registrar</button>
            </form>

            <div className="overflow-hidden rounded-md border border-gray-800 bg-[#15171a]">
              <div className="border-b border-gray-800 p-4"><h2 className="font-semibold text-white">Movimientos privados del propietario</h2><p className="mt-1 text-xs text-gray-500">Estos datos no estan disponibles para vendedores.</p></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-sm">
                  <thead className="bg-[#101214] text-xs uppercase text-gray-500"><tr><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Detalle</th><th className="p-3 text-left">Tipo</th><th className="p-3 text-right">Monto</th><th className="w-14 p-3"></th></tr></thead>
                  <tbody>
                    {summary.movimientos.map((item) => {
                      const income = item.categoria === "APORTE_PROPIETARIO";
                      return <tr key={item.id} className="border-t border-gray-800"><td className="p-3 text-gray-400">{new Date(item.fecha).toLocaleDateString("es-BO", { timeZone: "America/La_Paz" })}</td><td className="p-3"><p className="font-semibold text-white">{item.descripcion}</p><p className="text-xs text-gray-500">{item.sucursal?.nombre || "General"}{item.notas ? ` - ${item.notas}` : ""}</p></td><td className="p-3 text-gray-300">{categoryLabels[item.categoria]}</td><td className={`p-3 text-right font-semibold ${income ? "text-emerald-300" : "text-red-300"}`}>{income ? "+" : "-"}{money(item.monto)}</td><td className="p-3"><button type="button" onClick={() => void removeMovement(item.id)} title="Eliminar" className="flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={16} /></button></td></tr>;
                    })}
                    {summary.movimientos.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">No hay movimientos registrados este mes.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function BusinessStatus({ summary }: { summary: FinanceSummary }) {
  const styles = summary.estado.codigo === "VA_BIEN" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : summary.estado.codigo === "ATENCION" ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : summary.estado.codigo === "CON_PERDIDAS" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-gray-700 bg-gray-800/40 text-gray-300";
  const Icon = summary.estado.codigo === "VA_BIEN" ? CheckCircle2 : AlertTriangle;
  return <div className={`flex items-start gap-3 rounded-md border p-4 ${styles}`}><Icon className="mt-0.5 shrink-0" size={23} /><div><h2 className="font-bold">{summary.estado.titulo}</h2><p className="mt-1 text-sm opacity-90">{summary.estado.mensaje}</p></div></div>;
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof TrendingUp; label: string; value: string; detail: string; tone: string }) {
  return <div className="rounded-md border border-gray-800 bg-[#15171a] p-4"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold uppercase text-gray-500">{label}</p><Icon size={18} className={tone} /></div><p className={`mt-3 text-2xl font-bold ${tone}`}>{value}</p><p className="mt-1 text-xs text-gray-500">{detail}</p></div>;
}

function FlowRow({ icon: Icon, label, value, positive, negative }: { icon: typeof Building2; label: string; value: number; positive?: boolean; negative?: boolean }) {
  return <div className="flex items-center justify-between gap-4 px-4 py-3"><span className="flex items-center gap-2 text-gray-300"><Icon size={16} className={positive ? "text-emerald-400" : negative ? "text-red-400" : "text-gray-500"} />{label}</span><span className={`font-semibold ${positive ? "text-emerald-300" : negative ? "text-red-300" : "text-white"}`}>{positive ? "+" : negative ? "-" : ""}{money(value)}</span></div>;
}
