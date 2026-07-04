import { useEffect, useState } from "react";
import { AlertTriangle, Boxes, PackagePlus, ShoppingCart, Users, WalletCards } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "./StatCard";
import { fetchDashboardSummary } from "../../services/dashboard";
import { getErrorMessage } from "../../utils/errors";

type DashboardSummary = {
  totalVentasHoy?: number;
  ventasHoy?: number;
  clientesNuevos?: number;
  clientesConDeuda?: number;
  stockCritico?: unknown[];
  ventasPorDia?: Array<{ dia: string; total?: number }>;
  topProductos?: Array<{ codigo: string; descripcion: string; vendidos?: number }>;
  comprasRecientes?: Array<{ id: string; proveedor?: { nombre?: string }; createdAt: string; total?: number }>;
  movimientosRecientes?: Array<{ id: string; tipoMovimiento: string; producto?: { codigo?: string }; cantidad: number }>;
  ventasPorCliente?: Array<{ clienteId: string | null; cliente?: { nombre?: string }; ventas: number; total?: number }>;
  productosAgotados?: Array<{ id: string; codigo: string; descripcion: string; sucursal?: { nombre?: string } }>;
};

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardSummary().then(setSummary).catch((err: unknown) => setError(getErrorMessage(err)));
  }, []);

  return (
    <motion.main className="p-6 space-y-6 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">{error}</div>}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ventas Hoy" value={`Bs ${(summary?.totalVentasHoy || 0).toLocaleString()}`} icon={<ShoppingCart size={24} className="text-primary" />} change={`${summary?.ventasHoy || 0} ventas reales`} changePositive />
        <StatCard title="Clientes Nuevos" value={summary?.clientesNuevos || 0} icon={<Users size={24} className="text-primary" />} change="Mes actual" changePositive />
        <StatCard title="Clientes con Deuda" value={summary?.clientesConDeuda || 0} icon={<WalletCards size={24} className="text-primary" />} change="Cuentas pendientes" changePositive={false} />
        <StatCard title="Stock Critico" value={summary?.stockCritico?.length || 0} icon={<AlertTriangle size={24} className="text-primary" />} change="Productos bajo minimo" changePositive={false} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Ventas por Dia">
          {(summary?.ventasPorDia || []).length === 0 ? <Empty /> : (summary?.ventasPorDia || []).map((item) => (
            <Row key={item.dia} left={item.dia} right={`Bs ${(item.total || 0).toLocaleString()}`} />
          ))}
        </Panel>
        <Panel title="Productos mas Vendidos">
          {(summary?.topProductos || []).length === 0 ? <Empty /> : (summary?.topProductos || []).map((item) => (
            <Row key={item.codigo} left={`${item.codigo} · ${item.descripcion}`} right={`${item.vendidos || 0} uds`} />
          ))}
        </Panel>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Compras Recientes" icon={<PackagePlus size={18} className="text-primary" />}>
          {(summary?.comprasRecientes || []).length === 0 ? <Empty /> : (summary?.comprasRecientes || []).map((item) => (
            <Row key={item.id} left={`${item.proveedor?.nombre || 'Proveedor'} · ${new Date(item.createdAt).toLocaleDateString()}`} right={`Bs ${(item.total || 0).toLocaleString()}`} />
          ))}
        </Panel>
        <Panel title="Movimientos Recientes" icon={<Boxes size={18} className="text-primary" />}>
          {(summary?.movimientosRecientes || []).length === 0 ? <Empty /> : (summary?.movimientosRecientes || []).map((item) => (
            <Row key={item.id} left={`${item.tipoMovimiento} · ${item.producto?.codigo || ''}`} right={`${item.cantidad}`} />
          ))}
        </Panel>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Ventas por Cliente">
          {(summary?.ventasPorCliente || []).length === 0 ? <Empty /> : (summary?.ventasPorCliente || []).map((item) => (
            <Row key={item.clienteId} left={`${item.cliente?.nombre || 'Cliente'} · ${item.ventas} ventas`} right={`Bs ${(item.total || 0).toLocaleString()}`} />
          ))}
        </Panel>
        <Panel title="Productos Agotados">
          {(summary?.productosAgotados || []).length === 0 ? <Empty /> : (summary?.productosAgotados || []).map((item) => (
            <Row key={item.id} left={`${item.codigo} · ${item.descripcion}`} right={item.sucursal?.nombre || ''} />
          ))}
        </Panel>
      </section>
    </motion.main>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <div className="glass-panel p-5"><h3 className="font-semibold text-white mb-4 flex items-center gap-2">{icon}{title}</h3><div className="space-y-3">{children}</div></div>;
}

function Row({ left, right }: { left: string; right: string }) {
  return <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-grafito-900/40 p-3"><span className="text-gray-200">{left}</span><span className="font-bold text-primary-light">{right}</span></div>;
}

function Empty() {
  return <p className="text-gray-500">Sin datos registrados en PostgreSQL.</p>;
}
