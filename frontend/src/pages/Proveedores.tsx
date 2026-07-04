import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Edit, Plus, Search, Trash2, X } from "lucide-react";
import { Provider } from "../types";
import { createProvider, deleteProvider, fetchProviders, updateProvider, type ProviderInput } from "../services/providers";
import { getErrorMessage } from "../utils/errors";

const emptyForm: ProviderInput = { nombre: "", contacto: "", telefono: "", email: "", pais: "", direccion: "", notas: "", deudaPendiente: 0, activo: true };
const providerTextFields: Array<keyof Pick<ProviderInput, "nombre" | "contacto" | "telefono" | "email" | "pais" | "direccion" | "notas">> = ["nombre", "contacto", "telefono", "email", "pais", "direccion", "notas"];

export default function Proveedores() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"TODOS" | "DEUDA" | "ACTIVOS">("TODOS");
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [form, setForm] = useState<ProviderInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setProviders(await fetchProviders(search)); } catch (err: unknown) { setError(getErrorMessage(err)); }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => providers.filter(p => {
    if (filter === "DEUDA") return p.deudaPendiente > 0;
    if (filter === "ACTIVOS") return p.activo;
    return true;
  }), [providers, filter]);

  const openNew = () => { setSelected(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (p: Provider) => {
    setSelected(p);
    setForm({ nombre: p.nombre, contacto: p.contacto || "", telefono: p.telefono || "", email: p.email || "", pais: p.pais || "", direccion: p.direccion || "", notas: p.notas || "", deudaPendiente: p.deudaPendiente, activo: p.activo });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selected) {
        const updated = await updateProvider(selected.id, form);
        setProviders(prev => prev.map(p => p.id === updated.id ? updated : p));
      } else {
        const created = await createProvider(form);
        setProviders(prev => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err: unknown) { setError(getErrorMessage(err)); }
  };

  const remove = async (p: Provider) => {
    if (!confirm(`Desactivar proveedor ${p.nombre}?`)) return;
    await deleteProvider(p.id);
    setProviders(prev => prev.map(item => item.id === p.id ? { ...item, activo: false } : item));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Building2 className="text-primary" /> Proveedores</h2>
          <p className="text-gray-400 text-sm mt-1">Compras, contacto y deuda con proveedores</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nuevo proveedor</button>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">{error}</div>}
      <div className="glass-panel p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input className="premium-input pl-10" placeholder="Buscar proveedor..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} />
        </div>
        <button className="btn-secondary" onClick={load}>Buscar</button>
        <select className="premium-input lg:w-44" value={filter} onChange={e => setFilter(e.target.value as "TODOS" | "DEUDA" | "ACTIVOS")}>
          <option value="TODOS">Todos</option><option value="ACTIVOS">Activos</option><option value="DEUDA">Con deuda</option>
        </select>
      </div>
      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-grafito-800/80 border-b border-gray-700 text-sm uppercase text-gray-400"><tr><th className="p-4">Proveedor</th><th className="p-4">Contacto</th><th className="p-4">Pais</th><th className="p-4 text-right">Deuda</th><th className="p-4">Estado</th><th className="p-4 text-right">Acciones</th></tr></thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map(p => <tr key={p.id} className="hover:bg-grafito-800/50">
              <td className="p-4"><p className="font-semibold text-white">{p.nombre}</p><p className="text-sm text-gray-500">{p.direccion || "Sin direccion"}</p></td>
              <td className="p-4 text-gray-300"><p>{p.contacto || "-"}</p><p className="text-sm text-gray-500">{p.telefono || p.email || "-"}</p></td>
              <td className="p-4 text-gray-300">{p.pais || "-"}</td>
              <td className="p-4 text-right font-semibold text-primary-light">Bs {p.deudaPendiente.toLocaleString()}</td>
              <td className="p-4"><span className={`rounded-full px-2 py-1 text-xs border ${p.activo ? "text-green-300 border-green-500/30 bg-green-500/10" : "text-gray-400 border-gray-600"}`}>{p.activo ? "Activo" : "Inactivo"}</span></td>
              <td className="p-4"><div className="flex justify-end gap-1"><button onClick={() => openEdit(p)} className="p-2 text-gray-400 hover:text-white hover:bg-grafito-700 rounded-lg"><Edit size={16}/></button><button onClick={() => remove(p)} className="p-2 text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg"><Trash2 size={16}/></button></div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} /><form onSubmit={save} className="relative w-full max-w-3xl rounded-2xl border border-gray-700 bg-grafito-800 p-6 shadow-premium space-y-4"><div className="flex justify-between"><h3 className="text-xl font-bold text-white">{selected ? "Editar proveedor" : "Nuevo proveedor"}</h3><button type="button" onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white"><X/></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{providerTextFields.map(k => <label key={k} className="block"><span className="block text-sm text-gray-300 mb-1">{k}</span><input className="premium-input" value={form[k] || ""} onChange={e => setForm(f => ({...f, [k]: e.target.value}))} required={k==="nombre"} /></label>)}<label><span className="block text-sm text-gray-300 mb-1">deudaPendiente</span><input type="number" className="premium-input" value={form.deudaPendiente || 0} onChange={e => setForm(f => ({...f, deudaPendiente: Number(e.target.value)}))} /></label></div><div className="flex justify-end gap-3"><button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button><button className="btn-primary">Guardar</button></div></form></div>}
    </div>
  );
}
