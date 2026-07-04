import { useEffect, useState } from "react";
import { PackagePlus, Plus, Trash2 } from "lucide-react";
import { Product, Provider, Purchase, Sucursal } from "../types";
import { fetchProviders } from "../services/providers";
import { fetchProducts } from "../services/products";
import { fetchSucursales } from "../services/catalog";
import { createPurchase, fetchPurchases } from "../services/purchases";
import { getCurrentUser } from "../services/auth";
import { getErrorMessage } from "../utils/errors";

type Row = { productoId: string; cantidad: number; precioUnitario: number };

export default function Compras() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [items, setItems] = useState<Row[]>([{ productoId: "", cantidad: 1, precioUnitario: 1 }]);
  const [message, setMessage] = useState<string | null>(null);
  const user = getCurrentUser();

  useEffect(() => {
    Promise.all([fetchProviders(), fetchProducts(), fetchSucursales(), fetchPurchases()]).then(([pr, prod, suc, pur]) => {
      setProviders(pr); setProducts(prod); setSucursales(suc); setPurchases(pur);
      setProveedorId(pr[0]?.id || ""); setSucursalId(suc[0]?.id || "");
    }).catch((err: unknown) => setMessage(getErrorMessage(err)));
  }, []);

  const total = items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
  const updateRow = (idx: number, patch: Partial<Row>) => setItems(rows => rows.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const submit = async () => {
    if (!user) return setMessage("Sesion requerida");
    if (!proveedorId || !sucursalId || items.some(i => !i.productoId)) return setMessage("Completa proveedor, sucursal y productos.");
    try {
      const purchase = await createPurchase({ proveedorId, sucursalId, usuarioId: user.id, items });
      setPurchases(prev => [purchase, ...prev]);
      setItems([{ productoId: "", cantidad: 1, precioUnitario: 1 }]);
      setMessage("Compra registrada. Stock, costos y kardex actualizados.");
    } catch (err: unknown) { setMessage(getErrorMessage(err)); }
  };

  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold text-white flex items-center gap-2"><PackagePlus className="text-primary"/> Compras</h2><p className="text-gray-400 text-sm mt-1">Ingreso real de mercaderia con actualizacion de stock</p></div>
    {message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary-light">{message}</div>}
    <div className="glass-panel p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label><span className="block text-sm text-gray-300 mb-1">Proveedor</span><select className="premium-input" value={proveedorId} onChange={e => setProveedorId(e.target.value)}>{providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        <label><span className="block text-sm text-gray-300 mb-1">Sucursal</span><select className="premium-input" value={sucursalId} onChange={e => setSucursalId(e.target.value)}>{sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_120px_160px_44px] gap-3">
          <select className="premium-input" value={item.productoId} onChange={e => updateRow(idx, { productoId: e.target.value })}><option value="">Seleccionar producto</option>{products.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.descripcion} · {p.sucursal?.nombre}</option>)}</select>
          <input type="number" min="1" className="premium-input" value={item.cantidad} onChange={e => updateRow(idx, { cantidad: Number(e.target.value) })}/>
          <input type="number" min="0.01" step="0.01" className="premium-input" value={item.precioUnitario} onChange={e => updateRow(idx, { precioUnitario: Number(e.target.value) })}/>
          <button onClick={() => setItems(rows => rows.filter((_, i) => i !== idx))} className="btn-secondary"><Trash2 size={16}/></button>
        </div>)}
      </div>
      <div className="flex justify-between items-center border-t border-gray-700 pt-4"><button onClick={() => setItems(rows => [...rows, { productoId: "", cantidad: 1, precioUnitario: 1 }])} className="btn-secondary flex gap-2"><Plus size={18}/>Agregar item</button><div className="text-right"><p className="text-gray-400">Total compra</p><p className="text-3xl font-bold text-primary-light">Bs {total.toLocaleString()}</p></div></div>
      <button onClick={submit} className="btn-primary">Registrar compra</button>
    </div>
    <div className="glass-panel overflow-hidden"><table className="w-full text-left"><thead className="bg-grafito-800/80 text-sm uppercase text-gray-400"><tr><th className="p-4">Fecha</th><th className="p-4">Proveedor</th><th className="p-4">Sucursal</th><th className="p-4 text-right">Total</th></tr></thead><tbody className="divide-y divide-gray-800">{purchases.map(p => <tr key={p.id}><td className="p-4 text-gray-300">{new Date(p.createdAt).toLocaleString()}</td><td className="p-4 text-white">{p.proveedor?.nombre}</td><td className="p-4 text-gray-300">{p.sucursal?.nombre}</td><td className="p-4 text-right text-primary-light font-semibold">Bs {p.total.toLocaleString()}</td></tr>)}</tbody></table></div>
  </div>;
}
