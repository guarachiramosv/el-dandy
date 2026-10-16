import { useState } from "react";
import type React from "react";
import { Save, X } from "lucide-react";
import type { Provider } from "../../../types";
import { createProvider, type ProviderInput } from "../../../services/providers";
import { getErrorMessage } from "../../../utils/errors";

type QuickProviderModalProps = {
  onClose: () => void;
  onCreated: (provider: Provider) => void;
};

const initialForm: ProviderInput = {
  nombre: "",
  contacto: "",
  telefono: "",
  pais: "",
  direccion: "",
  activo: true,
};

export default function QuickProviderModal({ onClose, onCreated }: QuickProviderModalProps) {
  const [form, setForm] = useState<ProviderInput>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) return setError("El nombre del proveedor es obligatorio.");

    setSaving(true);
    setError(null);
    try {
      const created = await createProvider({
        ...form,
        nombre,
        contacto: form.contacto?.trim() || null,
        telefono: form.telefono?.trim() || null,
        pais: form.pais?.trim() || null,
        direccion: form.direccion?.trim() || null,
      });
      onCreated(created);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <form onSubmit={save} className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium">
        <div className="flex items-center justify-between border-b border-gray-700 bg-grafito-900/70 p-5">
          <div>
            <h3 className="text-xl font-bold text-white">Nuevo proveedor</h3>
            <p className="mt-1 text-sm text-gray-400">Se guardara y quedara seleccionado en la compra.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-gray-400 hover:text-white disabled:opacity-50">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-300">Nombre *</span>
            <input autoFocus className="premium-input" value={form.nombre} onChange={(event) => setForm(current => ({ ...current, nombre: event.target.value }))} placeholder="Nombre del proveedor" />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-300">Contacto</span>
              <input className="premium-input" value={form.contacto || ""} onChange={(event) => setForm(current => ({ ...current, contacto: event.target.value }))} placeholder="Opcional" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-300">Telefono</span>
              <input className="premium-input" value={form.telefono || ""} onChange={(event) => setForm(current => ({ ...current, telefono: event.target.value }))} placeholder="Opcional" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-300">Pais</span>
              <input className="premium-input" value={form.pais || ""} onChange={(event) => setForm(current => ({ ...current, pais: event.target.value }))} placeholder="Ej. Bolivia, Brasil" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-300">Direccion</span>
              <input className="premium-input" value={form.direccion || ""} onChange={(event) => setForm(current => ({ ...current, direccion: event.target.value }))} placeholder="Opcional" />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-700 bg-grafito-900/60 p-5">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
            <Save size={17} /> {saving ? "Guardando..." : "Guardar proveedor"}
          </button>
        </div>
      </form>
    </div>
  );
}
