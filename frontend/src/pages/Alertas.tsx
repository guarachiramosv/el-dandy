import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Boxes, CheckCircle2, PackageX, ShoppingCart } from "lucide-react";
import { Product, StockAlert } from "../types";
import { fetchStockAlerts, StockAlertFilter } from "../services/inventory";
import { getErrorMessage } from "../utils/errors";

type FilterOption = {
  id: StockAlertFilter;
  label: string;
  icon: React.ReactNode;
};

const filters: FilterOption[] = [
  { id: "todas", label: "Todas", icon: <Bell size={16} /> },
  { id: "vendido_stock_bajo", label: "Vendidos con poco stock", icon: <ShoppingCart size={16} /> },
  { id: "stock_bajo", label: "Stock bajo", icon: <Boxes size={16} /> },
  { id: "agotado", label: "Agotados", icon: <PackageX size={16} /> },
];

const typeStyles: Record<string, { label: string; badge: string; border: string }> = {
  VENDIDO_STOCK_BAJO: {
    label: "Vendido y bajo",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    border: "border-amber-500/30",
  },
  STOCK_BAJO: {
    label: "Stock bajo",
    badge: "border-orange-500/40 bg-orange-500/10 text-orange-200",
    border: "border-orange-500/30",
  },
  AGOTADO: {
    label: "Agotado",
    badge: "border-red-500/40 bg-red-500/10 text-red-200",
    border: "border-red-500/30",
  },
};

export default function Alertas() {
  const [selectedFilter, setSelectedFilter] = useState<StockAlertFilter>("todas");
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchStockAlerts()
      .then((data) => {
        if (active) setAlerts(data);
      })
      .catch((err: unknown) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const total = alerts.length;
    return filters.reduce<Record<StockAlertFilter, number>>(
      (acc, filter) => {
        acc[filter.id] = filter.id === "todas" ? total : alerts.filter((alert) => alertMatchesFilter(alert, filter.id)).length;
        return acc;
      },
      { todas: total, stock_bajo: 0, agotado: 0, vendido_stock_bajo: 0 }
    );
  }, [alerts]);

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => alertMatchesFilter(alert, selectedFilter)),
    [alerts, selectedFilter]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <AlertTriangle className="text-accent" /> Alertas
          </h2>
          <p className="mt-1 text-sm text-gray-400">Productos agotados, bajo minimo o vendidos recientemente con poco stock.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setSelectedFilter(filter.id)}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors ${
                selectedFilter === filter.id
                  ? "border-primary bg-primary/15 text-orange-200"
                  : "border-gray-800 bg-[#15171a] text-gray-400 hover:border-gray-700 hover:text-gray-100"
              }`}
            >
              {filter.icon}
              <span>{filter.label}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-200">{counts[filter.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      <div className="grid gap-3">
        {loading && <div className="glass-panel p-6 text-gray-400">Cargando alertas...</div>}

        {!loading && visibleAlerts.length === 0 && (
          <div className="glass-panel flex items-center gap-3 p-6 text-gray-400">
            <CheckCircle2 className="text-green-400" size={22} />
            No hay alertas para este filtro.
          </div>
        )}

        {!loading &&
          visibleAlerts.map((alert) => {
            const product = alert.producto;
            const style = typeStyles[alert.tipo] || typeStyles.STOCK_BAJO;

            return (
              <div key={alert.id} className={`glass-panel border p-4 ${style.border}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-gray-700 bg-black/20 px-2 py-1 font-mono text-sm font-semibold text-white">
                        Codigo: {product?.codigo || "Sin codigo"}
                      </span>
                      {product?.condicion && (
                        <span
                          className={`rounded border px-2 py-1 text-xs font-semibold ${
                            product.condicion === "USADO"
                              ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
                              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          }`}
                        >
                          {formatCondition(product.condicion)}
                        </span>
                      )}
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style.badge}`}>{style.label}</span>
                    </div>
                    <p className="font-semibold text-white">{product?.descripcion || "Producto sin descripcion"}</p>
                    <p className="text-sm text-gray-300">{alert.mensaje}</p>

                    <div className="grid gap-x-6 gap-y-2 border-t border-gray-800 pt-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <ProductDetail label="Codigo repuesto" value={product?.codigoRepuesto || "No registrado"} />
                      <ProductDetail label="Marca" value={product?.marca || "Sin marca"} />
                      <ProductDetail label="Categoria" value={product?.categoria?.nombre || "Sin categoria"} />
                      <ProductDetail label="Sucursal" value={product?.sucursal?.nombre || "Sin sucursal"} />
                      <ProductDetail label="Ubicacion" value={product?.ubicacion || "Sin ubicacion"} />
                      <ProductDetail label="Venta por" value={formatSaleUnit(product?.unidadVenta)} />
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-gray-800 pt-3 text-sm font-medium text-gray-300">
                      <span>Stock: {product?.stock ?? 0}</span>
                      <span>Minimo: {product?.stockMinimo ?? 0}</span>
                      {typeof alert.vendidosUltimos30Dias === "number" && <span>Vendidos en 30 dias: {alert.vendidosUltimos30Dias}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function alertMatchesFilter(alert: StockAlert, filter: StockAlertFilter) {
  if (filter === "todas") return true;
  if (filter === "stock_bajo") return alert.tipo === "STOCK_BAJO";
  if (filter === "agotado") return alert.tipo === "AGOTADO";
  return alert.tipo === "VENDIDO_STOCK_BAJO";
}

function ProductDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-xs font-medium uppercase text-gray-500">{label}</span>
      <span className="block truncate text-gray-300" title={value}>{value}</span>
    </div>
  );
}

function formatCondition(condition: string) {
  if (condition === "USADO") return "Usado";
  if (condition === "NUEVO") return "Nuevo";
  return condition;
}

function formatSaleUnit(unit?: Product["unidadVenta"]) {
  return unit === "METRO" ? "Metro" : "Unidad";
}
