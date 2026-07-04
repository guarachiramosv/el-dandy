import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Edit, Eye, Plus, Search, Star, Trash2, UserRound, X } from "lucide-react";
import { Customer } from "../types";
import { createCustomer, deleteCustomer, fetchCustomers, updateCustomer, type CustomerInput } from "../services/customers";
import { getErrorMessage } from "../utils/errors";

const emptyForm: CustomerInput = {
  nombre: "",
  telefono: "",
  email: "",
  empresa: "",
  ciudad: "",
  nit: "",
  direccion: "",
  notas: "",
  activo: true,
};

export default function Clientes() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "FRECUENTES" | "DEUDA">("TODOS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT" | "VIEW" | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerInput>(emptyForm);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await fetchCustomers(search));
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCustomers]);

  const filtered = useMemo(() => {
    return customers.filter(customer => {
      if (statusFilter === "FRECUENTES" && !customer.clienteFrecuente) return false;
      if (statusFilter === "DEUDA" && !(customer.saldoPendiente && customer.saldoPendiente > 0)) return false;
      return true;
    });
  }, [customers, statusFilter]);

  const openCreate = () => {
    setSelected(null);
    setForm(emptyForm);
    setModalMode("CREATE");
  };

  const openEdit = (customer: Customer) => {
    setSelected(customer);
    setForm({
      nombre: customer.nombre,
      telefono: customer.telefono || "",
      email: customer.email || "",
      empresa: customer.empresa || "",
      ciudad: customer.ciudad || "",
      nit: customer.nit || "",
      direccion: customer.direccion || "",
      notas: customer.notas || "",
      activo: customer.activo,
    });
    setModalMode("EDIT");
  };

  const openView = (customer: Customer) => {
    setSelected(customer);
    setModalMode("VIEW");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (modalMode === "EDIT" && selected) {
        const updated = await updateCustomer(selected.id, form);
        setCustomers(prev => prev.map(item => item.id === updated.id ? updated : item));
      } else {
        const created = await createCustomer(form);
        setCustomers(prev => [created, ...prev]);
      }
      setModalMode(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Eliminar cliente ${customer.nombre}?`)) return;
    await deleteCustomer(customer.id);
    setCustomers(prev => prev.filter(item => item.id !== customer.id));
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserRound className="text-primary" /> Clientes
          </h2>
          <p className="text-gray-400 text-sm mt-1">Historial, compras, deuda y datos comerciales</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">{error}</div>}

      <div className="glass-panel p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            className="premium-input pl-10"
            placeholder="Buscar por nombre, empresa, NIT, telefono o ciudad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadCustomers()}
          />
        </div>
        <button onClick={loadCustomers} className="btn-secondary">Buscar</button>
        <select className="premium-input lg:w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "TODOS" | "FRECUENTES" | "DEUDA")}>
          <option value="TODOS">Todos</option>
          <option value="FRECUENTES">Frecuentes</option>
          <option value="DEUDA">Con deuda</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric title="Clientes" value={customers.length} />
        <Metric title="Frecuentes" value={customers.filter(c => c.clienteFrecuente).length} />
        <Metric title="Con deuda" value={customers.filter(c => (c.saldoPendiente || 0) > 0).length} />
        <Metric title="Total cartera" value={`Bs ${customers.reduce((s, c) => s + (c.saldoPendiente || 0), 0).toLocaleString()}`} />
      </div>

      <div className="glass-panel overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-grafito-800/80 border-b border-gray-700 text-sm uppercase text-gray-400">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Contacto</th>
                <th className="p-4">Ciudad / NIT</th>
                <th className="p-4 text-right">Total gastado</th>
                <th className="p-4 text-right">Saldo</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr><td className="p-6 text-gray-400" colSpan={7}>Cargando clientes...</td></tr>
              ) : filtered.map(customer => (
                <tr key={customer.id} className="hover:bg-grafito-800/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{customer.nombre}</p>
                        <p className="text-sm text-gray-400">{customer.empresa || "Sin empresa"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300">
                    <p>{customer.telefono || "Sin telefono"}</p>
                    <p className="text-sm text-gray-500">{customer.email || "Sin email"}</p>
                  </td>
                  <td className="p-4 text-gray-300">
                    <p>{customer.ciudad || "Sin ciudad"}</p>
                    <p className="text-sm text-gray-500">NIT {customer.nit || "-"}</p>
                  </td>
                  <td className="p-4 text-right font-semibold text-primary-light">Bs {(customer.totalGastado || 0).toLocaleString()}</td>
                  <td className={`p-4 text-right font-semibold ${(customer.saldoPendiente || 0) > 0 ? "text-red-300" : "text-gray-300"}`}>
                    Bs {(customer.saldoPendiente || 0).toLocaleString()}
                  </td>
                  <td className="p-4">
                    {customer.clienteFrecuente ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-300">
                        <Star size={13} /> Frecuente
                      </span>
                    ) : (
                      <span className="rounded-full border border-gray-600 px-2 py-1 text-xs text-gray-400">Regular</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openView(customer)} className="p-2 text-gray-400 hover:text-white hover:bg-grafito-700 rounded-lg"><Eye size={16} /></button>
                      <button onClick={() => openEdit(customer)} className="p-2 text-gray-400 hover:text-white hover:bg-grafito-700 rounded-lg"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(customer)} className="p-2 text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalMode && (
        <CustomerModal
          mode={modalMode}
          customer={selected}
          form={form}
          setForm={setForm}
          onClose={() => setModalMode(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="glass-panel p-4">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function CustomerModal({
  mode,
  customer,
  form,
  setForm,
  onClose,
  onSubmit,
}: {
  mode: "CREATE" | "EDIT" | "VIEW";
  customer: Customer | null;
  form: CustomerInput;
  setForm: React.Dispatch<React.SetStateAction<CustomerInput>>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const readonly = mode === "VIEW";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium">
        <div className="flex items-center justify-between border-b border-gray-700 p-5">
          <h3 className="text-xl font-bold text-white">{mode === "CREATE" ? "Nuevo Cliente" : mode === "EDIT" ? "Editar Cliente" : "Detalle Cliente"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={22} /></button>
        </div>

        {readonly && customer ? (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-1 space-y-3">
              <Info label="Nombre" value={customer.nombre} />
              <Info label="Empresa" value={customer.empresa} />
              <Info label="Telefono" value={customer.telefono} />
              <Info label="Email" value={customer.email} />
              <Info label="Ciudad" value={customer.ciudad} />
              <Info label="NIT" value={customer.nit} />
              <Info label="Direccion" value={customer.direccion} />
              <Info label="Notas" value={customer.notas} />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Metric title="Compras" value={customer.cantidadCompras || 0} />
                <Metric title="Gastado" value={`Bs ${(customer.totalGastado || 0).toLocaleString()}`} />
                <Metric title="Deuda" value={`Bs ${(customer.saldoPendiente || 0).toLocaleString()}`} />
              </div>
              <div className="rounded-xl border border-gray-700 overflow-hidden">
                <div className="bg-grafito-900/60 p-3 font-semibold text-white">Ultimos pedidos</div>
                {(customer.ultimosPedidos || customer.ventas || []).length === 0 ? (
                  <p className="p-4 text-gray-400">Sin compras registradas.</p>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {(customer.ultimosPedidos || customer.ventas || []).map((sale) => (
                      <div key={sale.id} className="p-3 flex justify-between text-gray-300">
                        <span>{new Date(sale.createdAt).toLocaleDateString()} · {sale.tipoVenta}</span>
                        <span className="text-primary-light font-semibold">Bs {sale.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nombre" value={form.nombre} onChange={v => setForm(f => ({ ...f, nombre: v }))} required />
              <Field label="Telefono" value={form.telefono || ""} onChange={v => setForm(f => ({ ...f, telefono: v }))} />
              <Field label="Email" type="email" value={form.email || ""} onChange={v => setForm(f => ({ ...f, email: v }))} />
              <Field label="Empresa" value={form.empresa || ""} onChange={v => setForm(f => ({ ...f, empresa: v }))} />
              <Field label="Ciudad" value={form.ciudad || ""} onChange={v => setForm(f => ({ ...f, ciudad: v }))} />
              <Field label="NIT" value={form.nit || ""} onChange={v => setForm(f => ({ ...f, nit: v }))} />
              <Field label="Direccion" value={form.direccion || ""} onChange={v => setForm(f => ({ ...f, direccion: v }))} />
              <Field label="Notas" value={form.notas || ""} onChange={v => setForm(f => ({ ...f, notas: v }))} />
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-700 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-300">{label}</span>
      <input className="premium-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </label>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-grafito-900/40 p-3">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="text-gray-100 mt-1">{value || "-"}</p>
    </div>
  );
}
