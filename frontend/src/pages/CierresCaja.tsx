import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, RefreshCw, RotateCcw } from "lucide-react";
import { CashClosing } from "../types";
import { approveCashClosing, fetchCashClosingsForReview, observeCashClosing } from "../services/sales";
import { getErrorMessage } from "../utils/errors";

const money = (value: number) => `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value: string) => new Date(value).toLocaleDateString("es-BO", { timeZone: "America/La_Paz" });
const currentMonth = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
}).format(new Date());

export default function CierresCaja() {
  const [items, setItems] = useState<CashClosing[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonth);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchCashClosingsForReview(month));
    } catch (error: unknown) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  const review = async (closing: CashClosing, action: "approve" | "observe") => {
    const comentario = comments[closing.id]?.trim() || "";
    if (comentario.length < 3) return setMessage("Escribe un comentario de al menos 3 caracteres.");
    setProcessing(closing.id);
    setMessage(null);
    try {
      if (action === "observe" && closing.estado === "APROBADO") {
        const confirmed = window.confirm(`Se reabrirá el cierre del ${date(closing.fecha)} para que el vendedor lo corrija. ¿Continuar?`);
        if (!confirmed) return;
      }
      if (action === "approve") await approveCashClosing(closing.id, comentario);
      else await observeCashClosing(closing.id, comentario);
      setMessage(action === "approve"
        ? "Cierre aprobado correctamente."
        : closing.estado === "APROBADO"
          ? "Cierre reabierto y enviado al vendedor para correccion."
          : "Cierre devuelto al vendedor para correccion.");
      setComments((current) => ({ ...current, [closing.id]: "" }));
      await load();
    } catch (error: unknown) {
      setMessage(getErrorMessage(error));
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Revisión de cierres de caja</h2>
          <p className="mt-1 text-sm text-gray-400">Aprueba diferencias justificadas o devuelve el cierre al vendedor para corregirlo.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex h-11 items-center gap-2 rounded-lg border border-gray-700 bg-grafito-900 px-3 text-sm text-gray-300">
            <CalendarDays size={17} className="text-primary" />
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="bg-transparent text-white outline-none"
            />
          </label>
          <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary-light">{message}</div>}
      {!loading && items.length === 0 && (
        <div className="glass-panel p-8 text-center text-gray-400"><CheckCircle2 className="mx-auto mb-3 text-green-400" /> No hay cierres registrados en este mes.</div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {items.map((closing) => (
          <article key={closing.id} className={`glass-panel border p-5 ${closing.estado === "OBSERVADO" ? "border-amber-500/40" : closing.estado === "APROBADO" ? "border-green-500/30" : "border-gray-700"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black text-white">{closing.usuario?.nombre || "Vendedor"}</p>
                <p className="text-sm text-gray-400">{closing.sucursal?.nombre || "Sucursal"} · {date(closing.fecha)} · versión {closing.version || 1}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${closing.estado === "OBSERVADO" ? "bg-amber-500/15 text-amber-300" : closing.estado === "APROBADO" ? "bg-green-500/15 text-green-300" : "bg-blue-500/15 text-blue-300"}`}>
                {closing.estado}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Ventas" value={money(closing.totalVentas)} />
              <Stat label="Esperado" value={money(closing.netoEfectivo)} />
              <Stat label="Contado" value={money(closing.montoDeclarado)} />
              <Stat label="Diferencia" value={`${closing.diferencia > 0 ? "+" : ""}${money(closing.diferencia)}`} alert={Math.abs(closing.diferencia) > 0.01} />
            </div>

            {closing.notas && <p className="mt-4 rounded-lg bg-white/[0.04] p-3 text-sm text-gray-300"><strong>Nota del vendedor:</strong> {closing.notas}</p>}
            {closing.motivoObservacion && (
              <p className="mt-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100"><AlertTriangle size={18} className="shrink-0" /> {closing.motivoObservacion}</p>
            )}

            {closing.estado !== "OBSERVADO" && (
              <div className="mt-4 space-y-3">
                <textarea
                  className="premium-input min-h-24"
                  placeholder={closing.estado === "APROBADO" ? "Motivo obligatorio para reabrir este cierre" : "Comentario obligatorio: motivo de aprobación o corrección requerida"}
                  value={comments[closing.id] || ""}
                  onChange={(event) => setComments((current) => ({ ...current, [closing.id]: event.target.value }))}
                  maxLength={500}
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  {closing.estado === "PENDIENTE" && <button type="button" className="btn-primary flex flex-1 items-center justify-center gap-2" disabled={processing === closing.id} onClick={() => void review(closing, "approve")}>
                    <CheckCircle2 size={18} /> Aprobar cierre
                  </button>}
                  <button type="button" className="btn-secondary flex flex-1 items-center justify-center gap-2 text-amber-300" disabled={processing === closing.id} onClick={() => void review(closing, "observe")}>
                    <RotateCcw size={18} /> {closing.estado === "APROBADO" ? "Reabrir para corregir" : "Devolver para corregir"}
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className="rounded-lg bg-black/20 p-3"><p className="text-xs uppercase text-gray-500">{label}</p><p className={`mt-1 font-bold ${alert ? "text-amber-300" : "text-white"}`}>{value}</p></div>;
}
