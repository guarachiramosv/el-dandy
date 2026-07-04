import React, { useState } from "react";
import { KeyRound, X, Save } from "lucide-react";
import { changeOwnPassword } from "../services/users";
import { getErrorMessage } from "../utils/errors";

interface Props {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      setMessage("Contraseña actualizada exitosamente.");
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Error al cambiar la contraseña."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-grafito-800 p-6 shadow-premium">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="text-primary" />
            <h3 className="text-xl font-bold text-white">Cambiar contraseña</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={22} />
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">{error}</div>}
        {message && <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-green-300 text-sm">{message}</div>}

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-gray-300">Contraseña actual</span>
            <input
              type="password"
              className="premium-input w-full"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-300">Nueva contraseña</span>
            <input
              type="password"
              className="premium-input w-full"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-300">Confirmar nueva contraseña</span>
            <input
              type="password"
              className="premium-input w-full"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 disabled:opacity-60">
            <Save size={18} /> {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
