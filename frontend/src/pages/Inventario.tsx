import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Box, History, Printer, Search } from "lucide-react";
import { Product, StockMovement, Sucursal } from "../types";
import { useProducts } from "../hooks/useProducts";
import { fetchStockMovements, transferStock } from "../services/inventory";
import { getCurrentUser } from "../services/auth";
import { fetchSucursales } from "../services/catalog";
import { fetchProductInventoryReport, ProductInventoryReport, ReportPeriod } from "../services/reports";
import ImageLightbox from "../components/ImageLightbox";
import { productImageUrl } from "../utils/images";
import { getErrorMessage } from "../utils/errors";

const today = new Date();
const defaultDay = today.toISOString().slice(0, 10);
const defaultMonth = today.toISOString().slice(0, 7);
const defaultYear = String(today.getFullYear());

const valueForPeriod = (period: ReportPeriod, day: string, month: string, year: string) => {
  if (period === "year") return year;
  if (period === "month") return month;
  return day;
};

export default function Inventario() {
  const { data: products, loading, error } = useProducts();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState<"PRODUCTOS" | "KARDEX" | "TRANSFERIR">("PRODUCTOS");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null);
  const [printPeriod, setPrintPeriod] = useState<ReportPeriod>("day");
  const [printDay, setPrintDay] = useState(defaultDay);
  const [printMonth, setPrintMonth] = useState(defaultMonth);
  const [printYear, setPrintYear] = useState(defaultYear);
  const [printSucursalId, setPrintSucursalId] = useState("");
  const [inventoryReport, setInventoryReport] = useState<ProductInventoryReport | null>(null);
  const [printingReport, setPrintingReport] = useState(false);
  const user = getCurrentUser();

  const loadMovements = useCallback(() => fetchStockMovements().then(setMovements).catch((err: unknown) => setMessage(getErrorMessage(err))), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMovements();
      fetchSucursales().then(setSucursales).catch(() => setSucursales([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMovements]);

  const filtered = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return products.filter((product) =>
      product.descripcion.toLowerCase().includes(search) ||
      product.codigo.toLowerCase().includes(search) ||
      product.marca.toLowerCase().includes(search) ||
      (product.categoria?.nombre || "").toLowerCase().includes(search) ||
      (product.sucursal?.nombre || "").toLowerCase().includes(search) ||
      (product.ubicacion || "").toLowerCase().includes(search)
    );
  }, [products, searchTerm]);

  const getCoverImage = (product: Product) => product.imagenes?.[0]?.url || product.imagen;

  const submitTransfer = async () => {
    if (!user) return setMessage("Sesion requerida");
    try {
      await transferStock({ productoOrigenId: origen, productoDestinoId: destino, cantidad, usuarioId: user.id });
      setMessage("Transferencia registrada con movimientos dobles.");
      loadMovements();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    }
  };

  const handlePrintInventory = async () => {
    setMessage(null);
    setPrintingReport(true);
    try {
      const report = await fetchProductInventoryReport({
        period: printPeriod,
        value: valueForPeriod(printPeriod, printDay, printMonth, printYear),
        sucursalId: printSucursalId || undefined,
        search: searchTerm || undefined,
      });
      setInventoryReport(report);
      window.setTimeout(() => window.print(), 50);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "No se pudo preparar el reporte de inventario."));
    } finally {
      setPrintingReport(false);
    }
  };

  if (loading) return <div className="p-6 text-white">Cargando inventario...</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;

  return (
    <div className="flex h-full flex-col space-y-6">
      <InventoryPrintStyles />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Box className="text-primary" /> Inventario Real
          </h2>
          <p className="mt-1 text-sm text-gray-400">Stock por sucursal, kardex, transferencias e impresion de inventario</p>
        </div>
        <div className="flex gap-2">
          {["PRODUCTOS", "KARDEX", "TRANSFERIR"].map((item) => (
            <button key={item} onClick={() => setTab(item as "PRODUCTOS" | "KARDEX" | "TRANSFERIR")} className={tab === item ? "btn-primary" : "btn-secondary"}>
              {item}
            </button>
          ))}
        </div>
      </div>

      {message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary-light">{message}</div>}

      {tab === "PRODUCTOS" && (
        <>
          <div className="glass-panel p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                className="premium-input pl-10"
                placeholder="Buscar repuesto..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="glass-panel grid gap-3 p-4 md:grid-cols-5">
            <select className="premium-input" value={printPeriod} onChange={(event) => setPrintPeriod(event.target.value as ReportPeriod)}>
              <option value="day">Imprimir por dia</option>
              <option value="month">Imprimir por mes</option>
              <option value="year">Imprimir por anio</option>
            </select>
            {printPeriod === "day" && <input className="premium-input" type="date" value={printDay} onChange={(event) => setPrintDay(event.target.value)} />}
            {printPeriod === "month" && <input className="premium-input" type="month" value={printMonth} onChange={(event) => setPrintMonth(event.target.value)} />}
            {printPeriod === "year" && <input className="premium-input" type="number" min="2020" max="2100" value={printYear} onChange={(event) => setPrintYear(event.target.value)} />}
            <select className="premium-input" value={printSucursalId} onChange={(event) => setPrintSucursalId(event.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((sucursal) => <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>)}
            </select>
            <button onClick={handlePrintInventory} disabled={printingReport} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60">
              <Printer size={18} /> {printingReport ? "Preparando..." : "Imprimir inventario"}
            </button>
          </div>

          <div className="glass-panel overflow-hidden">
            <table className="w-full text-left">
              <thead className="border-b border-gray-700 bg-grafito-800/80 text-sm uppercase text-gray-400">
                <tr>
                  <th className="p-4">Img</th>
                  <th className="p-4">Codigo</th>
                  <th className="p-4">Producto</th>
                  <th className="p-4">Sucursal</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Minimo</th>
                  <th className="p-4 text-right">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((product) => {
                  const image = productImageUrl(getCoverImage(product));
                  return (
                    <tr key={product.id} className="hover:bg-grafito-800/50">
                      <td className="p-4">
                        {image ? (
                          <button type="button" onClick={() => setLightboxImage({ url: image, alt: product.descripcion })}>
                            <img src={image} alt={product.descripcion} className="h-12 w-12 rounded-lg object-cover" />
                          </button>
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-grafito-700 text-primary">
                            <Box size={18} />
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-mono text-gray-300">{product.codigo}</td>
                      <td className="p-4">
                        <p className="font-semibold text-white">{product.descripcion}</p>
                        <p className="text-sm text-gray-500">{product.marca} · {product.categoria?.nombre}</p>
                      </td>
                      <td className="p-4 text-gray-300">
                        <span className="block">{product.sucursal?.nombre}</span>
                        <span className="text-xs text-gray-500">{product.ubicacion || "Sin ubicacion"}</span>
                      </td>
                      <td className={`p-4 font-bold ${product.stock <= (product.stockMinimo || 5) ? "text-red-300" : "text-green-300"}`}>
                        {product.stock}
                      </td>
                      <td className="p-4 text-gray-300">{product.stockMinimo || 5}</td>
                      <td className="p-4 text-right text-primary-light">Bs {product.precioVenta.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "KARDEX" && (
        <div className="glass-panel overflow-hidden">
          <div className="flex items-center gap-2 p-4 font-semibold text-white">
            <History size={18} /> Historial de movimientos
          </div>
          <table className="w-full text-left">
            <thead className="bg-grafito-800/80 text-sm uppercase text-gray-400">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Producto</th>
                <th className="p-4">Cantidad</th>
                <th className="p-4">Antes</th>
                <th className="p-4">Nuevo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="p-4 text-gray-300">{new Date(movement.createdAt).toLocaleString()}</td>
                  <td className="p-4 text-primary-light">{movement.tipoMovimiento}</td>
                  <td className="p-4 text-white">{movement.producto?.codigo} · {movement.producto?.descripcion}</td>
                  <td className="p-4 text-gray-300">{movement.cantidad}</td>
                  <td className="p-4 text-gray-300">{movement.stockAnterior}</td>
                  <td className="p-4 text-white">{movement.stockNuevo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "TRANSFERIR" && (
        <div className="glass-panel max-w-3xl space-y-4 p-5">
          <h3 className="flex gap-2 text-xl font-bold text-white">
            <ArrowRightLeft className="text-primary" /> Transferencia entre sucursales
          </h3>
          <select className="premium-input" value={origen} onChange={(event) => setOrigen(event.target.value)}>
            <option value="">Producto origen</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.codigo} · {product.descripcion} · {product.sucursal?.nombre} · Stock {product.stock}
              </option>
            ))}
          </select>
          <select className="premium-input" value={destino} onChange={(event) => setDestino(event.target.value)}>
            <option value="">Producto destino</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.codigo} · {product.descripcion} · {product.sucursal?.nombre}
              </option>
            ))}
          </select>
          <input type="number" min="1" className="premium-input" value={cantidad} onChange={(event) => setCantidad(Number(event.target.value))} />
          <button onClick={submitTransfer} className="btn-primary">Transferir stock</button>
        </div>
      )}

      <InventoryPrintArea report={inventoryReport} sucursal={sucursales.find((item) => item.id === printSucursalId)?.nombre || "Todas"} />
      <ImageLightbox imageUrl={lightboxImage?.url || null} alt={lightboxImage?.alt} onClose={() => setLightboxImage(null)} />
    </div>
  );
}

function InventoryPrintStyles() {
  return (
    <style>{`
      @media print {
        @page { margin: 12mm; size: A4 landscape; }
        html, body, #root {
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
          background: #ffffff !important;
          color: #111827 !important;
        }
        body * { visibility: hidden !important; }
        #product-inventory-print, #product-inventory-print * { visibility: visible !important; }
        #product-inventory-print {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          display: block !important;
          width: 100% !important;
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
          padding: 0 !important;
          border: 0 !important;
          box-shadow: none !important;
          background: #ffffff !important;
          color: #111827 !important;
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 12px !important;
          line-height: 1.25 !important;
        }
        #product-inventory-print * {
          box-shadow: none !important;
          text-shadow: none !important;
          color: #111827 !important;
          background: transparent !important;
          font-size: 12px !important;
          line-height: 1.25 !important;
        }
        #product-inventory-print h1, #product-inventory-print strong {
          color: #0a0a0a !important;
        }
        #product-inventory-print h1 {
          font-size: 20px !important;
          margin: 0 0 4px 0 !important;
        }
        #product-inventory-print .print-card {
          border: 1px solid #d1d5db !important;
          background: #ffffff !important;
          padding: 6px 8px !important;
          border-radius: 4px !important;
        }
        #product-inventory-print table {
          width: 100% !important;
          border-collapse: collapse !important;
          table-layout: fixed !important;
        }
        #product-inventory-print thead, #product-inventory-print th {
          background: #f3f4f6 !important;
          color: #111827 !important;
          font-weight: 800 !important;
        }
        #product-inventory-print td, #product-inventory-print th {
          border-bottom: 1px solid #e5e7eb !important;
          padding: 5px 6px !important;
          vertical-align: top !important;
          overflow-wrap: anywhere !important;
        }
        tr { page-break-inside: avoid; }
      }
    `}</style>
  );
}

function InventoryPrintArea({ report, sucursal }: { report: ProductInventoryReport | null; sucursal: string }) {
  if (!report) return <div id="product-inventory-print" className="hidden" />;

  return (
    <div id="product-inventory-print" className="hidden print:block p-6">
      <div className="mb-5 border-b border-gray-300 pb-4">
        <h1 className="text-2xl font-black text-gray-950">Reporte de inventario de productos</h1>
        <p className="text-sm text-gray-700">Periodo: {report.label}</p>
        <p className="text-sm text-gray-700">Sucursal: {sucursal}</p>
        <p className="text-sm text-gray-700">Generado: {new Date().toLocaleString("es-BO")}</p>
      </div>

      <div className="mb-5 grid grid-cols-5 gap-3">
        <PrintStat label="Productos" value={String(report.totals.productos)} />
        <PrintStat label="Tenia antes" value={String(report.totals.stockInicial)} />
        <PrintStat label="Vendido" value={String(report.totals.vendidos)} />
        <PrintStat label="Otros mov." value={String(report.totals.otrosMovimientos)} />
        <PrintStat label="Tiene ahora" value={String(report.totals.stockActual)} />
      </div>

      <table className="w-full text-left text-sm text-gray-950">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Codigo</th>
            <th className="p-2">Producto</th>
            <th className="p-2">Sucursal</th>
            <th className="p-2 text-right">Tenia antes</th>
            <th className="p-2 text-right">Vendido</th>
            <th className="p-2 text-right">Otros</th>
            <th className="p-2 text-right">Tiene ahora</th>
            <th className="p-2 text-right">Minimo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {report.items.map((item) => (
            <tr key={item.productoId}>
              <td className="p-2 font-mono">{item.codigo}</td>
              <td className="p-2">
                <p className="font-semibold">{item.descripcion}</p>
                <p className="text-xs text-gray-600">{item.marca} - {item.categoria}</p>
              </td>
              <td className="p-2">
                <p>{item.sucursal}</p>
                <p className="text-xs text-gray-600">{item.ubicacion || "Sin ubicacion"}</p>
              </td>
              <td className="p-2 text-right">{item.stockInicial}</td>
              <td className="p-2 text-right">{item.vendidos}</td>
              <td className="p-2 text-right">{item.otrosMovimientos}</td>
              <td className="p-2 text-right font-bold">{item.stockActual}</td>
              <td className="p-2 text-right">{item.stockMinimo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrintStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-card rounded-lg border border-gray-300 bg-white p-3">
      <p className="text-xs uppercase text-gray-600">{label}</p>
      <p className="mt-1 text-xl font-black text-gray-950">{value}</p>
    </div>
  );
}
