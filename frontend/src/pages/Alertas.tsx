import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { StockAlert } from "../types";
import { fetchStockAlerts } from "../services/inventory";

export default function Alertas() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  useEffect(() => { fetchStockAlerts().then(setAlerts); }, []);
  return <div className="space-y-6"><div><h2 className="text-2xl font-bold text-white flex items-center gap-2"><AlertTriangle className="text-accent"/> Alertas de Stock</h2><p className="text-gray-400 text-sm mt-1">Productos bajo minimo o agotados</p></div><div className="grid gap-3">{alerts.length === 0 && <div className="glass-panel p-6 text-gray-400">No hay alertas activas.</div>}{alerts.map(a => <div key={a.id} className="glass-panel p-4 border-red-500/30"><div className="flex justify-between"><div><p className="text-white font-semibold">{a.producto?.codigo} · {a.producto?.descripcion}</p><p className="text-red-300">{a.mensaje}</p><p className="text-sm text-gray-500">{a.producto?.sucursal?.nombre} · Stock {a.producto?.stock}</p></div><span className="rounded-full bg-red-500/10 border border-red-500/30 text-red-300 px-3 py-1 h-fit text-sm">{a.tipo}</span></div></div>)}</div></div>;
}
