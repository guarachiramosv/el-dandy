import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Printer } from "lucide-react";
import { fetchSucursales } from "../services/catalog";
import { fetchSalesHistoryReport, ReportPeriod, SalesHistoryReport } from "../services/reports";
import type { Sucursal } from "../types";

const today = new Date();
const localDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(today);
const defaultDay = localDateParts;
const defaultMonth = localDateParts.slice(0, 7);
const defaultYear = String(today.getFullYear());

const money = (value: number) => `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const branchNameFrom = (item: { usuario?: { sucursal?: { nombre: string } }; sucursal?: { nombre: string } }) =>
  item.usuario?.sucursal?.nombre || item.sucursal?.nombre || "Sucursal";

const sanitizePdfText = (value: string) =>
  Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code <= 126 ? char : " ";
    })
    .join("");

function valueForPeriod(period: ReportPeriod, day: string, month: string, year: string) {
  if (period === "year") return year;
  if (period === "month") return month;
  return day;
}

const cleanPdfText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .map((char) => sanitizePdfText(char))
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const fitPdfText = (value: unknown, maxChars: number) => {
  const text = cleanPdfText(value);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
};

const wrapPdfText = (value: unknown, maxChars: number) => {
  const words = cleanPdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines;
};

const pdfText = (value: unknown, x: number, y: number, size = 9, bold = false) =>
  `BT /F${bold ? 2 : 1} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${cleanPdfText(value)}) Tj ET\n`;

const pdfLine = (x1: number, y1: number, x2: number, y2: number) =>
  `q 0.55 0.58 0.64 RG 0.5 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q\n`;

const pdfFillRect = (x: number, y: number, width: number, height: number, color: string) =>
  `q ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q\n`;

const salesReportPdfBytes = (report: SalesHistoryReport, sucursal: string) => {
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 30;
  const bottom = 34;
  const rowHeight = 18;
  const pages: string[] = [];
  const closingNotes = (report.cierres || [])
    .filter((cierre) => cierre.notas?.trim())
    .map((cierre) => ({
      seller: cierre.usuario?.nombre || "Vendedor",
      branch: branchNameFrom(cierre),
      note: cierre.notas || "",
    }));
  const rows: Array<{ kind: "section" | "closing" | "sale" | "note"; cells: string[] }> = [
    { kind: "section", cells: ["Cierres enviados por vendedores"] },
    ...(report.cierres || []).map((cierre) => ({
      kind: "closing" as const,
      cells: [
        new Date(cierre.fecha).toLocaleDateString("es-BO"),
        cierre.usuario?.nombre || "Vendedor",
        branchNameFrom(cierre),
        String(cierre.cantidadVentas),
        money(cierre.totalVentas),
        money(cierre.netoEfectivo),
        money(cierre.netoQr),
        money(cierre.montoDeclarado),
        money(cierre.diferencia),
      ],
    })),
    { kind: "section", cells: ["Ventas registradas"] },
    ...report.ventas.map((sale) => ({
      kind: "sale" as const,
      cells: [
        new Date(sale.createdAt).toLocaleString("es-BO"),
        sale.usuario?.nombre || "Usuario",
        branchNameFrom(sale),
        sale.cliente?.nombre || "Sin cliente",
        `${sale.tipoVenta} / ${sale.metodoPago}`,
        String(sale.detalles?.length || 0),
        money(sale.total),
      ],
    })),
    ...(closingNotes.length
      ? [
          { kind: "section" as const, cells: ["Notas de cierre"] },
          ...closingNotes.map((item) => ({
            kind: "note" as const,
            cells: [item.seller, item.branch, item.note],
          })),
        ]
      : []),
  ];

  const drawHeader = (pageNumber: number) => {
    let content = "";
    content += pdfText("Reporte diario de ventas", margin, 560, 16, true);
    content += pdfText(`Periodo: ${report.label}`, margin, 542, 9);
    content += pdfText(`Sucursal: ${sucursal}`, margin, 528, 9);
    content += pdfText(`Generado: ${new Date().toLocaleString("es-BO")}`, margin, 514, 9);
    content += pdfText(`Pagina ${pageNumber}`, 770, 560, 9, true);

    const stats = [
      ["Ventas", report.totals.cantidadVentas],
      ["Total", money(report.totals.totalVentas)],
      ["Cierres", report.totals.cantidadCierres || 0],
      ["Efectivo cierre", money(report.totals.cierreEfectivo || 0)],
      ["QR cierre", money(report.totals.cierreQr || 0)],
      ["Declarado", money(report.totals.montoDeclarado || 0)],
      ["Diferencia", money(report.totals.diferencia || 0)],
    ];
    stats.forEach(([label, value], index) => {
      const x = margin + index * 111;
      content += pdfFillRect(x, 470, 103, 34, "0.96 0.97 0.98");
      content += pdfText(label, x + 7, 489, 7, true);
      content += pdfText(value, x + 7, 476, 9, true);
    });
    content += pdfLine(margin, 458, pageWidth - margin, 458);
    return content;
  };

  let page = drawHeader(1);
  let y = 438;
  let pageNumber = 1;

  const newPage = () => {
    pages.push(page);
    pageNumber += 1;
    page = drawHeader(pageNumber);
    y = 438;
  };

  rows.forEach((row) => {
    const noteLines = row.kind === "note" ? wrapPdfText(row.cells[2], 118) : [];
    const neededHeight = row.kind === "section" ? rowHeight : rowHeight + noteLines.length * 10;
    if (y < bottom + neededHeight) newPage();

    if (row.kind === "section") {
      page += pdfFillRect(margin, y - 4, pageWidth - margin * 2, 18, "0.92 0.93 0.95");
      page += pdfText(row.cells[0], margin + 6, y + 2, 9, true);
      if (row.cells[0].startsWith("Notas")) {
        y -= 26;
        return;
      }
      y -= 24;
      if (row.cells[0].startsWith("Cierres")) {
        page += pdfText("Fecha", 36, y + 4, 7, true);
        page += pdfText("Vendedor", 100, y + 4, 7, true);
        page += pdfText("Sucursal", 230, y + 4, 7, true);
        page += pdfText("Ventas", 315, y + 4, 7, true);
        page += pdfText("Total", 360, y + 4, 7, true);
        page += pdfText("Efectivo", 435, y + 4, 7, true);
        page += pdfText("QR", 520, y + 4, 7, true);
        page += pdfText("Declarado", 590, y + 4, 7, true);
        page += pdfText("Dif.", 700, y + 4, 7, true);
      } else {
        page += pdfText("Fecha", 36, y + 4, 7, true);
        page += pdfText("Vendedor", 156, y + 4, 7, true);
        page += pdfText("Sucursal", 270, y + 4, 7, true);
        page += pdfText("Cliente", 380, y + 4, 7, true);
        page += pdfText("Pago", 510, y + 4, 7, true);
        page += pdfText("Items", 630, y + 4, 7, true);
        page += pdfText("Total", 700, y + 4, 7, true);
      }
      y -= rowHeight;
      return;
    }

    page += pdfLine(margin, y - 3, pageWidth - margin, y - 3);
    if (row.kind === "closing") {
      page += pdfText(fitPdfText(row.cells[0], 12), 36, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[1], 24), 100, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[2], 14), 230, y + 3, 7);
      page += pdfText(row.cells[3], 315, y + 3, 7);
      page += pdfText(row.cells[4], 360, y + 3, 7);
      page += pdfText(row.cells[5], 435, y + 3, 7);
      page += pdfText(row.cells[6], 520, y + 3, 7);
      page += pdfText(row.cells[7], 590, y + 3, 7);
      page += pdfText(row.cells[8], 700, y + 3, 7);
    } else if (row.kind === "note") {
      const boxHeight = Math.max(22, 14 + noteLines.length * 10);
      page += pdfFillRect(margin, y - boxHeight + 6, pageWidth - margin * 2, boxHeight, "0.98 0.98 0.98");
      page += pdfText(`Nota del vendedor - ${row.cells[0]} / ${row.cells[1]}`, margin + 8, y + 1, 8, true);
      noteLines.forEach((line, index) => {
        page += pdfText(line, margin + 8, y - 10 - index * 10, 8);
      });
    } else {
      page += pdfText(fitPdfText(row.cells[0], 22), 36, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[1], 20), 156, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[2], 18), 270, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[3], 20), 380, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[4], 18), 510, y + 3, 7);
      page += pdfText(row.cells[5], 630, y + 3, 7);
      page += pdfText(row.cells[6], 700, y + 3, 7);
    }
    y -= row.kind === "note" ? Math.max(28, 20 + noteLines.length * 10) : rowHeight;
  });

  pages.push(page);

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

const downloadSalesReportPdf = (report: SalesHistoryReport, sucursal: string) => {
  const blob = new Blob([salesReportPdfBytes(report, sucursal)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte-ventas-${report.label}-${sucursal.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function Reportes() {
  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [day, setDay] = useState(defaultDay);
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [sucursalId, setSucursalId] = useState("");
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [report, setReport] = useState<SalesHistoryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportValue = useMemo(() => valueForPeriod(period, day, month, year), [period, day, month, year]);

  useEffect(() => {
    fetchSucursales().then(setSucursales).catch(() => setSucursales([]));
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchSalesHistoryReport({ period, value: reportValue, sucursalId: sucursalId || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial de ventas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReport();
    }, 0);
    return () => window.clearTimeout(timer);
    // Carga inicial con filtros por defecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSucursal = sucursales.find((item) => item.id === sucursalId)?.nombre || "Todas";

  return (
    <section className="flex h-full flex-col gap-5 p-6 text-gray-100">
      <style>{`
        @media print {
          @page { margin: 10mm; size: A4 landscape; }
          html, body, #root {
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #111827 !important;
          }
          body * { visibility: hidden !important; }
          #sales-print, #sales-print * { visibility: visible !important; }
          #sales-print {
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
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #111827 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 12px !important;
            line-height: 1.25 !important;
          }
          #sales-print::before { display: none !important; }
          #sales-print * {
            box-shadow: none !important;
            text-shadow: none !important;
            color: #111827 !important;
            background: transparent !important;
            font-size: 12px !important;
            line-height: 1.25 !important;
          }
          #sales-print h2, #sales-print h3, #sales-print strong, #sales-print .print-strong {
            color: #0a0a0a !important;
          }
          #sales-print h2 {
            font-size: 20px !important;
            margin: 0 0 4px 0 !important;
          }
          #sales-print h3 {
            font-size: 14px !important;
            margin: 14px 0 6px 0 !important;
          }
          #sales-print .print-muted {
            color: #4b5563 !important;
          }
          #sales-print .sales-print-header {
            display: flex !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 16px !important;
            margin-bottom: 12px !important;
            padding-bottom: 8px !important;
            border-bottom: 1px solid #d1d5db !important;
          }
          #sales-print .sales-print-meta {
            text-align: right !important;
            min-width: 180px !important;
          }
          #sales-print .sales-stats-grid {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 6px !important;
            margin: 8px 0 12px 0 !important;
          }
          #sales-print .print-card {
            border: 1px solid #d1d5db !important;
            background: #ffffff !important;
            padding: 6px 8px !important;
            border-radius: 4px !important;
          }
          #sales-print .print-card p:first-child {
            font-size: 10px !important;
            margin: 0 0 2px 0 !important;
            letter-spacing: 0 !important;
          }
          #sales-print .print-card p:last-child {
            font-size: 12px !important;
            margin: 0 !important;
          }
          #sales-print table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            margin-bottom: 10px !important;
          }
          #sales-print thead {
            display: table-header-group !important;
            background: #f3f4f6 !important;
          }
          #sales-print th {
            background: #f3f4f6 !important;
            color: #111827 !important;
            font-weight: 800 !important;
          }
          #sales-print td, #sales-print th {
            border-bottom: 1px solid #e5e7eb !important;
            padding: 5px 6px !important;
            vertical-align: top !important;
            word-break: normal !important;
            overflow-wrap: anywhere !important;
          }
          #sales-print .col-code { width: 12% !important; }
          #sales-print .col-product { width: 34% !important; }
          #sales-print .col-branch { width: 20% !important; }
          #sales-print .col-qty { width: 14% !important; }
          #sales-print .col-total { width: 20% !important; }
          #sales-print .col-date { width: 22% !important; }
          #sales-print .col-seller { width: 18% !important; }
          #sales-print .col-client { width: 18% !important; }
          #sales-print .col-payment { width: 20% !important; }
          #sales-print .col-items { width: 10% !important; }
          #sales-print .col-sale-total { width: 12% !important; }
          .no-print { display: none !important; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Historial de ventas</h1>
          <p className="text-sm text-gray-400">Consulta e imprime lo vendido por dia, mes o anio.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={() => report && downloadSalesReportPdf(report, selectedSucursal)} disabled={!report} className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60">
            <Download size={18} /> Descargar PDF
          </button>
          <button onClick={() => window.print()} className="btn-primary flex items-center justify-center gap-2">
            <Printer size={18} /> Imprimir
          </button>
        </div>
      </div>

      <div className="no-print glass-panel grid gap-3 p-4 md:grid-cols-4 xl:grid-cols-[180px_220px_1fr_180px]">
        <select className="premium-input" value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}>
          <option value="day">Dia</option>
          <option value="month">Mes</option>
          <option value="year">Anio</option>
        </select>

        {period === "day" && <input className="premium-input" type="date" value={day} onChange={(event) => setDay(event.target.value)} />}
        {period === "month" && <input className="premium-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />}
        {period === "year" && <input className="premium-input" type="number" min="2020" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />}

        <select className="premium-input" value={sucursalId} onChange={(event) => setSucursalId(event.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursales.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
          ))}
        </select>

        <button onClick={loadReport} disabled={loading} className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60">
          <CalendarDays size={18} /> {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {error && <div className="no-print rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">{error}</div>}

      <div id="sales-print" className="glass-panel flex-1 overflow-auto p-5 print:rounded-none print:border-0 print:p-6">
        <div className="sales-print-header mb-5 border-b border-gray-700 pb-4 print:border-gray-300">
          <div>
            <h2 className="text-2xl font-black text-white print:text-gray-950">Historial de ventas</h2>
            <p className="print-muted text-sm text-gray-400 print:text-gray-700">Reporte administrativo de ventas</p>
          </div>
          <div className="sales-print-meta">
            <p className="print-muted text-sm text-gray-400 print:text-gray-700">Periodo: {report?.label || reportValue}</p>
            <p className="print-muted text-sm text-gray-400 print:text-gray-700">Sucursal: {selectedSucursal}</p>
            <p className="print-muted text-sm text-gray-400 print:text-gray-700">Generado: {new Date().toLocaleString("es-BO")}</p>
          </div>
        </div>

        {!report ? (
          <p className="text-gray-400">Sin datos.</p>
        ) : (
          <div className="space-y-6">
            <div className="sales-stats-grid grid gap-3 md:grid-cols-4">
              <Stat label="Ventas" value={String(report.totals.cantidadVentas)} />
              <Stat label="Total" value={money(report.totals.totalVentas)} />
              <Stat label="Gastos" value={money(report.totals.totalGastos || 0)} />
              <Stat label="Disponible" value={money(report.totals.totalDisponible ?? report.totals.totalVentas)} />
              <Stat label="Efectivo neto" value={money(report.totals.netoEfectivo ?? report.totals.totalEfectivo)} />
              <Stat label="QR neto" value={money(report.totals.netoQr ?? report.totals.totalQr)} />
              <Stat label="Unidades" value={String(report.totals.unidadesVendidas)} />
              <Stat label="Descuento" value={money(report.totals.descuento)} />
              <Stat label="Items" value={String(report.totals.cantidadItems)} />
              <Stat label="Cierres recibidos" value={String(report.totals.cantidadCierres || 0)} />
              <Stat label="Efectivo cierre" value={money(report.totals.cierreEfectivo || 0)} />
              <Stat label="QR cierre" value={money(report.totals.cierreQr || 0)} />
              <Stat label="Declarado" value={money(report.totals.montoDeclarado || 0)} />
              <Stat label="Diferencia" value={money(report.totals.diferencia || 0)} />
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Cierres enviados por vendedores</h3>
              <table className="w-full text-left text-sm">
                <thead className="bg-grafito-800 text-gray-300 print:bg-gray-100 print:text-gray-900">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Vendedor</th>
                    <th className="p-3">Sucursal</th>
                    <th className="p-3 text-right">Ventas</th>
                    <th className="p-3 text-right">Total ventas</th>
                    <th className="p-3 text-right">Efectivo cierre</th>
                    <th className="p-3 text-right">QR cierre</th>
                    <th className="p-3 text-right">Declarado</th>
                    <th className="p-3 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-200">
                  {(report.cierres || []).map((cierre) => (
                    <tr key={cierre.id}>
                      <td className="p-3">{new Date(cierre.fecha).toLocaleDateString("es-BO")}</td>
                      <td className="p-3">{cierre.usuario?.nombre || "Vendedor"}</td>
                      <td className="p-3">{branchNameFrom(cierre)}</td>
                      <td className="p-3 text-right">{cierre.cantidadVentas}</td>
                      <td className="p-3 text-right font-bold">{money(cierre.totalVentas)}</td>
                      <td className="p-3 text-right font-bold text-green-300 print:text-gray-950">{money(cierre.netoEfectivo)}</td>
                      <td className="p-3 text-right font-bold text-sky-300 print:text-gray-950">{money(cierre.netoQr)}</td>
                      <td className="p-3 text-right">{money(cierre.montoDeclarado)}</td>
                      <td className={`p-3 text-right font-bold ${cierre.diferencia === 0 ? "text-green-300 print:text-gray-950" : "text-red-300 print:text-gray-950"}`}>
                        {money(cierre.diferencia)}
                      </td>
                    </tr>
                  ))}
                  {(report.cierres || []).length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-gray-500">
                        No hay cierre de caja para este periodo o sucursal.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Productos vendidos</h3>
              <table className="w-full text-left text-sm">
                <thead className="bg-grafito-800 text-gray-300 print:bg-gray-100 print:text-gray-900">
                  <tr>
                    <th className="col-code p-3">Codigo</th>
                    <th className="col-product p-3">Producto</th>
                    <th className="col-branch p-3">Sucursal</th>
                    <th className="col-qty p-3 text-right">Cantidad</th>
                    <th className="col-total p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-200">
                  {report.productosVendidos.map((item) => (
                    <tr key={item.productoId}>
                      <td className="p-3 font-mono">{item.codigo}</td>
                      <td className="p-3">
                        <p className="font-semibold">{item.descripcion}</p>
                        <p className="print-muted text-xs text-gray-500 print:text-gray-600">{item.marca} - {item.categoria}</p>
                      </td>
                      <td className="p-3">{item.sucursal}</td>
                      <td className="p-3 text-right">{item.cantidad}</td>
                      <td className="p-3 text-right">{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Gastos registrados</h3>
              <table className="w-full text-left text-sm">
                <thead className="bg-grafito-800 text-gray-300 print:bg-gray-100 print:text-gray-900">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Vendedor</th>
                    <th className="p-3">Sucursal</th>
                    <th className="p-3">Motivo</th>
                    <th className="p-3">Origen</th>
                    <th className="p-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-200">
                  {(report.gastos || []).map((expense) => (
                    <tr key={expense.id}>
                      <td className="p-3">{new Date(expense.createdAt).toLocaleString("es-BO")}</td>
                      <td className="p-3">{expense.usuario?.nombre || "Usuario"}</td>
                      <td className="p-3">{branchNameFrom(expense)}</td>
                      <td className="p-3">
                        <p className="font-semibold">{expense.motivo}</p>
                        {expense.notas && <p className="print-muted text-xs text-gray-500 print:text-gray-600">{expense.notas}</p>}
                      </td>
                      <td className="p-3">{expense.metodoPago}</td>
                      <td className="p-3 text-right font-bold">{money(expense.monto)}</td>
                    </tr>
                  ))}
                  {(report.gastos || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-gray-500">Sin gastos en este periodo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Ventas registradas</h3>
              <table className="w-full text-left text-sm">
                <thead className="bg-grafito-800 text-gray-300 print:bg-gray-100 print:text-gray-900">
                  <tr>
                    <th className="col-date p-3">Fecha</th>
                    <th className="col-seller p-3">Vendedor</th>
                    <th className="p-3">Sucursal</th>
                    <th className="col-client p-3">Cliente</th>
                    <th className="col-payment p-3">Pago</th>
                    <th className="col-items p-3 text-right">Items</th>
                    <th className="col-sale-total p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-200">
                  {report.ventas.map((sale) => (
                    <tr key={sale.id}>
                      <td className="p-3">{new Date(sale.createdAt).toLocaleString("es-BO")}</td>
                      <td className="p-3">{sale.usuario?.nombre || "Usuario"}</td>
                      <td className="p-3">{branchNameFrom(sale)}</td>
                      <td className="p-3">{sale.cliente?.nombre || "Sin cliente"}</td>
                      <td className="p-3">{sale.tipoVenta} / {sale.metodoPago}</td>
                      <td className="p-3 text-right">{sale.detalles?.length || 0}</td>
                      <td className="p-3 text-right font-bold">{money(sale.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(report.cierres || []).some((cierre) => cierre.notas?.trim()) && (
              <div>
                <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Notas de cierre</h3>
                <div className="space-y-2">
                  {(report.cierres || [])
                    .filter((cierre) => cierre.notas?.trim())
                    .map((cierre) => (
                      <div key={`nota-${cierre.id}`} className="rounded border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100 print:border-gray-300 print:bg-gray-50 print:text-gray-800">
                        <p className="font-bold print:text-gray-950">
                          Nota del vendedor - {cierre.usuario?.nombre || "Vendedor"} / {branchNameFrom(cierre)}
                        </p>
                        <p className="mt-1">{cierre.notas}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-card rounded-lg border border-gray-700 bg-grafito-900 p-3 print:border-gray-300 print:bg-white">
      <p className="print-muted text-xs uppercase text-gray-500 print:text-gray-600">{label}</p>
      <p className="print-strong mt-1 text-xl font-black text-white print:text-gray-950">{value}</p>
    </div>
  );
}
