import { LogOut, X } from "lucide-react";

type ConfirmLogoutModalProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmLogoutModal({ onCancel, onConfirm }: ConfirmLogoutModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Cancelar cierre de sesion"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium">
        <div className="flex items-center justify-between border-b border-gray-700 bg-grafito-900/80 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary-light">
              <LogOut size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Cerrar sesion</h3>
              <p className="text-sm text-gray-400">Confirma antes de salir del sistema.</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-gray-400 hover:bg-grafito-700 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <p className="text-gray-200">Deseas cerrar sesion y volver a la pantalla de ingreso?</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancelar
            </button>
            <button type="button" onClick={onConfirm} className="btn-primary flex items-center justify-center gap-2">
              <LogOut size={18} /> Si, cerrar sesion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
