import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit, KeyRound, Plus, Power, Save, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { Sucursal, User } from "../types";
import { fetchSucursales } from "../services/catalog";
import { createUser, fetchUsers, toggleUserActive, updateUser, type UserInput } from "../services/users";
import { getErrorMessage } from "../utils/errors";

const emptyForm: UserInput = {
  nombre: "",
  email: "",
  password: "",
  role: "SELLER",
  sucursalId: "",
  activo: true,
};

export default function Usuarios() {
  const [users, setUsers] = useState<User[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [form, setForm] = useState<UserInput>(emptyForm);
  const [editing, setEditing] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, sucursalData] = await Promise.all([fetchUsers(), fetchSucursales()]);
      setUsers(userData);
      setSucursales(sucursalData);
      setForm((prev) => ({ ...prev, sucursalId: prev.sucursalId || sucursalData[0]?.id || "" }));
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return users.filter((user) =>
      user.nombre.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.role.toLowerCase().includes(term),
    );
  }, [users, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sucursalId: sucursales[0]?.id || "" });
    setOpen(true);
    setMessage(null);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      nombre: user.nombre,
      email: user.email,
      password: "",
      role: user.role,
      sucursalId: user.sucursalId,
      activo: user.activo,
    });
    setOpen(true);
    setMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (editing) {
        const payload: Partial<UserInput> = {
          nombre: form.nombre,
          email: form.email,
          role: form.role,
          sucursalId: form.sucursalId,
          activo: form.activo,
        };
        if (form.password?.trim()) payload.password = form.password;
        await updateUser(editing.id, payload);
        setMessage("Usuario actualizado correctamente.");
      } else {
        if (!form.password) throw new Error("Asigna una contrasena temporal.");
        await createUser({
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          role: form.role,
          sucursalId: form.sucursalId,
        });
        setMessage("Usuario creado con contrasena temporal.");
      }
      setOpen(false);
      await load();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (user: User) => {
    setMessage(null);
    try {
      await toggleUserActive(user.id);
      setMessage(user.activo ? "Usuario inactivado." : "Usuario activado.");
      await load();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    }
  };

  if (loading) return <div className="p-6 text-white">Cargando usuarios...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserRound className="text-primary" /> Usuarios
          </h2>
          <p className="mt-1 text-sm text-gray-400">Crea vendedores, asigna contrasenas temporales y controla su estado.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center justify-center gap-2">
          <Plus size={18} /> Nuevo vendedor
        </button>
      </div>

      {message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary-light">{message}</div>}

      <div className="glass-panel p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
          <input
            className="premium-input pl-10"
            placeholder="Buscar por nombre, correo o rol"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-grafito-800/80 text-xs uppercase text-gray-500">
            <tr>
              <th className="p-4">Usuario</th>
              <th className="p-4">Rol</th>
              <th className="p-4">Sucursal</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-grafito-800/50">
                <td className="p-4">
                  <p className="font-semibold text-white">{user.nombre}</p>
                  <p className="text-sm text-gray-400">{user.email}</p>
                </td>
                <td className="p-4">
                  <span className={`rounded-lg px-2 py-1 text-xs font-bold ${user.role === "ADMIN" ? "bg-primary/10 text-primary-light" : "bg-green-500/10 text-green-300"}`}>
                    {user.role === "ADMIN" ? "Administrador" : "Vendedor"}
                  </span>
                </td>
                <td className="p-4 text-gray-300">{user.sucursal?.nombre || "Sucursal"}</td>
                <td className="p-4">
                  <span className={`rounded-lg px-2 py-1 text-xs font-bold ${user.activo ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                    {user.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(user)} className="rounded-lg border border-gray-700 p-2 text-gray-300 hover:border-primary hover:text-primary">
                      <Edit size={17} />
                    </button>
                    <button onClick={() => handleToggle(user)} className={`rounded-lg border p-2 ${user.activo ? "border-red-500/40 text-red-300 hover:bg-red-500/10" : "border-green-500/40 text-green-300 hover:bg-green-500/10"}`}>
                      <Power size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <form onSubmit={handleSubmit} className="relative w-full max-w-2xl rounded-2xl border border-gray-700 bg-grafito-800 p-6 shadow-premium">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">{editing ? "Editar usuario" : "Nuevo vendedor"}</h3>
                <p className="text-sm text-gray-400">
                  {editing ? "Puedes actualizar datos, estado o asignar nueva contrasena temporal." : "El admin entrega esta contrasena temporal al vendedor."}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
                <X size={22} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Nombre" value={form.nombre} onChange={(value) => setForm((prev) => ({ ...prev, nombre: value }))} required />
              <Input label="Correo" type="email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} required />
              <label className="block">
                <span className="mb-1 block text-sm text-gray-300">Rol</span>
                <select className="premium-input" value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserInput["role"] }))}>
                  <option value="SELLER">Vendedor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-gray-300">Sucursal</span>
                <select className="premium-input" value={form.sucursalId} onChange={(event) => setForm((prev) => ({ ...prev, sucursalId: event.target.value }))} required>
                  {sucursales.map((sucursal) => (
                    <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
                  ))}
                </select>
              </label>
              <Input
                label={editing ? "Nueva contrasena temporal (opcional)" : "Contrasena temporal"}
                type="text"
                value={form.password || ""}
                onChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
                required={!editing}
              />
              <label className="flex items-center gap-3 rounded-xl border border-gray-700 bg-grafito-900/40 p-4 text-gray-200">
                <input
                  type="checkbox"
                  checked={form.activo ?? true}
                  onChange={(event) => setForm((prev) => ({ ...prev, activo: event.target.checked }))}
                />
                Usuario activo
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                {editing ? <Save size={18} /> : <ShieldCheck size={18} />} {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear usuario"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-grafito-900/40 p-4 text-sm text-gray-300">
        <p className="flex items-center gap-2 font-semibold text-white"><KeyRound size={17} /> Seguridad de contrasena</p>
        <p className="mt-1">El administrador define una contrasena temporal. Luego el vendedor debe cambiarla desde su cuenta usando su contrasena actual.</p>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-300">{label}</span>
      <input type={type} className="premium-input" value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}
