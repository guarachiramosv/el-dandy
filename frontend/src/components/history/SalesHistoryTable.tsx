import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { Sale } from "../../types";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const formatTime = (value: string) => new Date(value).toLocaleTimeString("es-BO", {
  hour: "numeric",
  minute: "2-digit",
});

const paymentLabel = (sale: Sale) => sale.tipoVenta === "CREDITO" ? "CREDITO" : sale.metodoPago;

const paymentTone = (method: string) => {
  if (method === "EFECTIVO") return "border-green-500/40 bg-green-500/10 text-green-200";
  if (method === "QR") return "border-blue-500/40 bg-blue-500/10 text-blue-200";
  if (method === "CREDITO") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-gray-600 bg-gray-700/30 text-gray-200";
};

export function SalesHistoryTable({
  sales,
  money,
  onSelect,
}: {
  sales: Sale[];
  money: (value: number) => string;
  onSelect: (sale: Sale) => void;
}) {
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("TODOS");

  const filteredSales = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    return sales.filter((sale) => {
      const method = paymentLabel(sale);
      const searchable = normalize([
        sale.cliente?.nombre || "Cliente ocasional",
        sale.id,
        sale.total.toFixed(2),
        method,
      ].join(" "));
      return (payment === "TODOS" || method === payment) && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [payment, query, sales]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#15171a]">
      <div className="flex flex-col gap-3 border-b border-gray-800 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-lg font-bold text-white">Ventas del día</h4>
          <p className="text-sm text-gray-500">{sales.length} ventas registradas</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="premium-input h-10 pl-10"
              placeholder="Buscar venta, cliente o monto..."
              aria-label="Buscar en las ventas del día"
            />
          </label>
          <select
            value={payment}
            onChange={(event) => setPayment(event.target.value)}
            className="premium-input h-10 sm:w-44"
            aria-label="Filtrar por forma de pago"
          >
            <option value="TODOS">Todos los pagos</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="QR">QR</option>
            <option value="MIXTO">Mixto</option>
            <option value="CREDITO">Crédito</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="TARJETA">Tarjeta</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-left">
          <thead className="bg-[#101214] text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Hora</th>
              <th className="px-4 py-3">Venta</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="w-16 px-4 py-3"><span className="sr-only">Acción</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-sm">
            {filteredSales.map((sale) => {
              const method = paymentLabel(sale);
              return (
                <tr
                  key={sale.id}
                  onClick={() => onSelect(sale)}
                  className="cursor-pointer bg-[#15171a] transition hover:bg-[#1b1e22]"
                >
                  <td className="px-4 py-3">
                    <span className="block font-bold text-white">{formatTime(sale.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500" title={sale.id}>#{sale.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3 font-semibold text-gray-100">{sale.cliente?.nombre || "Cliente ocasional"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-bold ${paymentTone(method)}`}>{method}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-primary-light">{money(sale.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); onSelect(sale); }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-700 text-gray-400 transition hover:border-primary/50 hover:text-primary-light"
                      aria-label={`Ver detalle de la venta de ${sale.cliente?.nombre || "Cliente ocasional"}`}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredSales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  {sales.length === 0 ? "Aún no hay ventas en este día." : "No hay ventas que coincidan con el filtro."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

