import { AlertTriangle, ArrowLeft } from "lucide-react";

interface CorrectionBannerProps {
  dateLabel: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onBack: () => void;
}

export function CorrectionBanner({ dateLabel, reason, onReasonChange, onBack }: CorrectionBannerProps) {
  return (
    <section className="rounded-md border border-amber-600/60 bg-amber-950/35 px-4 py-3 text-amber-50">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-400" size={25} />
          <div className="min-w-0">
            <p className="font-bold">Corrigiendo caja del {dateLabel}</p>
            <p className="text-sm text-amber-100/75">Las ventas se asignarán a esta fecha.</p>
            <label className="mt-2 flex max-w-2xl items-center gap-2 text-xs text-amber-100/70">
              <span className="shrink-0 font-semibold uppercase tracking-wide">Motivo</span>
              <input
                className="h-8 min-w-0 flex-1 rounded border border-amber-700/50 bg-black/20 px-2 text-sm text-amber-50 outline-none focus:border-amber-500"
                maxLength={300}
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                aria-label="Motivo de la corrección"
              />
            </label>
          </div>
        </div>
        <button type="button" className="btn-secondary flex shrink-0 items-center justify-center gap-2" onClick={onBack}>
          <ArrowLeft size={17} /> Volver al historial
        </button>
      </div>
    </section>
  );
}
