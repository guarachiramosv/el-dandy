import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Box, Download, History, Printer, Search } from "lucide-react";
import { Product, StockMovement } from "../types";
import { useProducts } from "../hooks/useProducts";
import { fetchStockMovements, transferStock } from "../services/inventory";
import { getCurrentUser } from "../services/auth";
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

const cleanPdfText = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const fitPdfText = (value: string | number | null | undefined, maxChars: number) => {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
};

const pdfText = (value: string | number | null | undefined, x: number, y: number, size = 9, bold = false) =>
  `BT /F${bold ? 2 : 1} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${cleanPdfText(value)}) Tj ET\n`;

const pdfFillRect = (x: number, y: number, width: number, height: number, color: string) =>
  `q ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q\n`;

const pdfLine = (x1: number, y1: number, x2: number, y2: number) =>
  `q 0.86 0.88 0.91 RG 0.5 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q\n`;

const inventoryPdfBytes = (report: ProductInventoryReport) => {
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 28;
  const tableTop = 438;
  const rowHeight = 20;
  const bottom = 34;
  const rowsPerPage = Math.floor((tableTop - bottom) / rowHeight);
  const columns = [
    { label: "Codigo", x: 34, width: 58, chars: 10, align: "left" },
    { label: "Producto", x: 96, width: 150, chars: 32, align: "left" },
    { label: "Sucursal", x: 252, width: 92, chars: 17, align: "left" },
    { label: "Tenia antes", x: 358, width: 72, chars: 8, align: "right" },
    { label: "Vendido", x: 440, width: 58, chars: 8, align: "right" },
    { label: "Otros", x: 508, width: 52, chars: 8, align: "right" },
    { label: "Tiene ahora", x: 572, width: 72, chars: 8, align: "right" },
    { label: "Minimo", x: 658, width: 52, chars: 8, align: "right" },
    { label: "Marca", x: 722, width: 80, chars: 14, align: "left" },
  ];
  const pages: string[] = [];

  for (let start = 0; start < report.items.length || start === 0; start += rowsPerPage) {
    const pageNumber = pages.length + 1;
    const pageItems = report.items.slice(start, start + rowsPerPage);
    let content = "";
    content += pdfText("Reporte de inventario de productos", margin, 558, 16, true);
    content += pdfText(`Periodo: ${report.label}`, margin, 538, 9);
    content += pdfText("Sucursal: Todas", margin, 524, 9);
    content += pdfText(`Generado: ${new Date().toLocaleString("es-BO")}`, margin, 510, 9);
    content += pdfText(`Pagina ${pageNumber}`, 760, 558, 9, true);

    const statWidth = 146;
    const stats = [
      ["Productos", report.totals.productos],
      ["Tenia antes", report.totals.stockInicial],
      ["Vendido", report.totals.vendidos],
      ["Otros mov.", report.totals.otrosMovimientos],
      ["Tiene ahora", report.totals.stockActual],
    ];
    stats.forEach(([label, value], index) => {
      const x = margin + index * (statWidth + 8);
      content += pdfFillRect(x, 462, statWidth, 34, "0.96 0.97 0.98");
      content += pdfText(label, x + 7, 482, 7, true);
      content += pdfText(value, x + 7, 468, 11, true);
    });

    content += pdfFillRect(margin, tableTop, pageWidth - margin * 2, 18, "0.94 0.95 0.97");
    columns.forEach((column) => {
      content += pdfText(column.label, column.x, tableTop + 6, 7, true);
    });

    pageItems.forEach((item, index) => {
      const y = tableTop - 19 - index * rowHeight;
      const rowValues = [
        item.codigo,
        item.descripcion,
        `${item.sucursal} ${item.ubicacion || ""}`.trim(),
        item.stockInicial,
        item.vendidos,
        item.otrosMovimientos,
        item.stockActual,
        item.stockMinimo,
        item.marca,
      ];
      if (index % 2 === 1) content += pdfFillRect(margin, y - 4, pageWidth - margin * 2, rowHeight, "0.985 0.985 0.985");
      content += pdfLine(margin, y - 5, pageWidth - margin, y - 5);
      rowValues.forEach((value, valueIndex) => {
        const column = columns[valueIndex];
        const text = fitPdfText(value, column.chars);
        const x = column.align === "right" ? column.x + column.width - String(text).length * 4.5 : column.x;
        content += pdfText(text, x, y + 3, 7);
      });
    });

    pages.push(content);
    if (pageItems.length < rowsPerPage) break;
  }

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const pageObjectNumbers: number[] = [];
  pages.forEach((content) => {
    const streamNumber = objects.length + 2;
    pageObjectNumbers.push(objects.length + 1);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamNumber} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Uint8Array(Array.from(pdf, (char) => char.charCodeAt(0) & 0xff));
};

const downloadInventoryPdf = (report: ProductInventoryReport) => {
  const blob = new Blob([inventoryPdfBytes(report)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeLabel = report.label.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  link.href = url;
  link.download = `inventario-${safeLabel || report.period}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function Inventario() {
  const user = getCurrentUser();
  const isSeller = user?.role === "SELLER";
  const { data: products, loading, error } = useProducts("active", {
    scope: isSeller ? "all" : "branch",
    refreshIntervalMs: isSeller ? 10000 : 0,
  });
  const [movements, setMovements] = useState<StockMovement[]>([]);
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
  const [inventoryReport, setInventoryReport] = useState<ProductInventoryReport | null>(null);
  const [printingReport, setPrintingReport] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const loadMovements = useCallback(() => fetchStockMovements().then(setMovements).catch((err: unknown) => setMessage(getErrorMessage(err))), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (isSeller) return;
      void loadMovements();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isSeller, loadMovements]);

  const filtered = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return products.filter((product) =>
      product.descripcion.toLowerCase().includes(search) ||
      product.codigo.toLowerCase().includes(search) ||
      (product.codigoRepuesto || "").toLowerCase().includes(search) ||
      product.marca.toLowerCase().includes(search) ||
      (product.categoria?.nombre || "").toLowerCase().includes(search) ||
      (product.sucursal?.nombre || "").toLowerCase().includes(search) ||
      (product.ubicacion || "").toLowerCase().includes(search)
    );
  }, [products, searchTerm]);

  const getCoverImage = (product: Product) => product.imagenes?.[0]?.url || product.imagen;
  const getUnitLabel = (product: Product) => product.unidadVenta === "METRO" ? "m" : "u";

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
    if (isSeller) {
      setMessage("El vendedor solo puede consultar inventario.");
      return;
    }
    setMessage(null);
    setPrintingReport(true);
    try {
      const report = await fetchProductInventoryReport({
        period: printPeriod,
        value: valueForPeriod(printPeriod, printDay, printMonth, printYear),
      });
      setInventoryReport(report);
      window.setTimeout(() => window.print(), 250);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "No se pudo preparar el reporte de inventario."));
    } finally {
      setPrintingReport(false);
    }
  };

  const handleDownloadInventory = async () => {
    if (isSeller) {
      setMessage("El vendedor solo puede consultar inventario.");
      return;
    }
    setMessage(null);
    setDownloadingReport(true);
    try {
      const report = await fetchProductInventoryReport({
        period: printPeriod,
        value: valueForPeriod(printPeriod, printDay, printMonth, printYear),
      });
      setInventoryReport(report);
      downloadInventoryPdf(report);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "No se pudo descargar el reporte de inventario."));
    } finally {
      setDownloadingReport(false);
    }
  };

  if (loading) return <div className="p-6 text-white">Cargando inventario...</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;

  const tabs: Array<"PRODUCTOS" | "KARDEX" | "TRANSFERIR"> = isSeller ? ["PRODUCTOS"] : ["PRODUCTOS", "KARDEX", "TRANSFERIR"];

  return (
    <div className="flex h-full flex-col space-y-6">
      <InventoryPrintStyles />

      <div className="no-print flex flex-col space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Box className="text-primary" /> Inventario Real
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {isSeller ? "Consulta de productos y stock disponible" : "Stock por sucursal, kardex, transferencias e impresion de inventario"}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`flex min-h-14 items-center justify-center rounded-lg px-6 text-sm font-bold transition-colors ${
                tab === item
                  ? "bg-primary-gradient text-white shadow-lg shadow-primary/20"
                  : "border border-white/10 bg-grafito-900/80 text-gray-200 hover:border-primary/40 hover:bg-grafito-700 hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary-light">{message}</div>}

      {tab === "PRODUCTOS" && (
        <>
          <div className="rounded-xl border border-white/10 bg-grafito-900/80 p-4 shadow-inner">
            <div className="grid gap-4 xl:grid-cols-[minmax(280px,1fr)_auto] xl:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
                <input
                  className="premium-input h-14 rounded-lg pl-10 text-base"
                  placeholder="Buscar repuesto..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              {!isSeller && (
                <div className="grid gap-3 sm:grid-cols-4 xl:w-[780px]">
                  <select className="premium-input h-14 rounded-lg py-0 text-base" value={printPeriod} onChange={(event) => setPrintPeriod(event.target.value as ReportPeriod)}>
                    <option value="day">Imprimir por dia</option>
                    <option value="month">Imprimir por mes</option>
                    <option value="year">Imprimir por anio</option>
                  </select>
                  {printPeriod === "day" && <input className="premium-input h-14 rounded-lg py-0 text-base" type="date" value={printDay} onChange={(event) => setPrintDay(event.target.value)} />}
                  {printPeriod === "month" && <input className="premium-input h-14 rounded-lg py-0 text-base" type="month" value={printMonth} onChange={(event) => setPrintMonth(event.target.value)} />}
                  {printPeriod === "year" && <input className="premium-input h-14 rounded-lg py-0 text-base" type="number" min="2020" max="2100" value={printYear} onChange={(event) => setPrintYear(event.target.value)} />}
                  <button onClick={handlePrintInventory} disabled={printingReport || downloadingReport} className="btn-primary flex h-14 items-center justify-center gap-2 rounded-lg px-4 py-0 text-base disabled:opacity-60">
                    <Printer size={18} /> {printingReport ? "Preparando..." : "Imprimir"}
                  </button>
                  <button onClick={handleDownloadInventory} disabled={printingReport || downloadingReport} className="btn-secondary flex h-14 items-center justify-center gap-2 rounded-lg px-4 py-0 text-base disabled:opacity-60">
                    <Download size={18} /> {downloadingReport ? "Descargando..." : "Descargar PDF"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel overflow-hidden">
            <table className="w-full text-left">
              <thead className="border-b border-gray-700 bg-grafito-800/80 text-sm uppercase text-gray-400">
                <tr>
                  <th className="p-3">Img</th>
                  <th className="p-3">Codigo</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Sucursal</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">Minimo</th>
                  <th className="p-3 text-right">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((product) => {
                  const image = productImageUrl(getCoverImage(product));
                  return (
                    <tr key={product.id} className="hover:bg-grafito-800/50">
                      <td className="p-3">
                        {image ? (
                          <button type="button" onClick={() => setLightboxImage({ url: image, alt: product.descripcion })}>
                            <img src={image} alt={product.descripcion} className="h-11 w-11 rounded-lg object-cover" />
                          </button>
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-grafito-700 text-primary">
                            <Box size={18} />
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-gray-300">
                        <span className="block">{product.codigo}</span>
                        {product.codigoRepuesto && (
                          <span className="mt-1 block text-xs text-gray-500">Rep. {product.codigoRepuesto}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-white">{product.descripcion}</p>
                        <p className="text-sm text-gray-500">{product.marca} · {product.categoria?.nombre}</p>
                      </td>
                      <td className="p-3 text-gray-300">
                        <span className="block">{product.sucursal?.nombre}</span>
                        <span className="text-xs text-gray-500">{product.ubicacion || "Sin ubicacion"}</span>
                      </td>
                      <td className={`p-3 font-bold ${product.stock <= (product.stockMinimo || 5) ? "text-red-300" : "text-green-300"}`}>
                        {product.stock} {getUnitLabel(product)}
                      </td>
                      <td className="p-3 text-gray-300">{product.stockMinimo || 5} {getUnitLabel(product)}</td>
                      <td className="p-3 text-right text-primary-light">Bs {product.precioVenta.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="border-t border-gray-800 p-10 text-center text-gray-500">
                No hay productos para mostrar.
              </div>
            )}
          </div>
        </>
      )}

      {!isSeller && tab === "KARDEX" && (
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

      {!isSeller && tab === "TRANSFERIR" && (
        <div className="glass-panel max-w-3xl space-y-4 p-5">
          <h3 className="flex gap-2 text-xl font-bold text-white">
            <ArrowRightLeft className="text-primary" /> Transferencia entre sucursales
          </h3>
          <select className="premium-input" value={origen} onChange={(event) => setOrigen(event.target.value)}>
            <option value="">Producto origen</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.codigo} · {product.descripcion} · {product.sucursal?.nombre} · Stock {product.stock} {getUnitLabel(product)}
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
      </div>

      {!isSeller && <InventoryPrintArea report={inventoryReport} />}
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
          min-height: 0 !important;
          overflow: visible !important;
          background: #ffffff !important;
          color: #111827 !important;
        }
        body > #root > div,
        body > #root > div > div,
        main {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          max-height: none !important;
          min-height: 0 !important;
          overflow: visible !important;
          padding: 0 !important;
          margin: 0 !important;
          background: #ffffff !important;
        }
        body > #root > div > aside,
        body > #root > div > div > header,
        .no-print,
        .no-print * {
          display: none !important;
        }
        body * { visibility: hidden !important; }
        #product-inventory-print, #product-inventory-print * { visibility: visible !important; }
        #product-inventory-print {
          position: static !important;
          left: 0 !important;
          top: 0 !important;
          display: block !important;
          width: 100% !important;
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
          padding: 0 !important;
          margin: 0 !important;
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
        #product-inventory-print thead {
          display: table-header-group !important;
        }
        #product-inventory-print tfoot {
          display: table-footer-group !important;
        }
        #product-inventory-print tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }
    `}</style>
  );
}

function InventoryPrintArea({ report }: { report: ProductInventoryReport | null }) {
  if (!report) return <div id="product-inventory-print" className="hidden" />;

  return (
    <div id="product-inventory-print" className="hidden print:block p-6">
      <div className="mb-5 border-b border-gray-300 pb-4">
        <h1 className="text-2xl font-black text-gray-950">Reporte de inventario de productos</h1>
        <p className="text-sm text-gray-700">Periodo: {report.label}</p>
        <p className="text-sm text-gray-700">Sucursal: Todas</p>
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
