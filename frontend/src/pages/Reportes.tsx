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

const salePaymentLabel = (tipoVenta: string, metodoPago: string) =>
  tipoVenta === "CREDITO" ? "CREDITO" : metodoPago;

const remainingCashAfterExpenses = (report: SalesHistoryReport) =>
  Math.max((report.totals.totalEfectivo || 0) - (report.totals.gastoEfectivo || 0), 0);

const remainingQrAfterExpenses = (report: SalesHistoryReport) =>
  Math.max((report.totals.totalQr || 0) - (report.totals.gastoQr || 0), 0);

const saleDetailRowsFrom = (report: SalesHistoryReport) =>
  report.ventas.flatMap((sale) =>
    (sale.detalles || []).map((detail) => ({
      id: `${sale.id}-${detail.id}`,
      fecha: sale.createdAt,
      vendedor: sale.usuario?.nombre || "Usuario",
      sucursal: branchNameFrom(sale),
      pago: salePaymentLabel(sale.tipoVenta, sale.metodoPago),
      producto: detail.producto?.descripcion || detail.descripcion || "Detalle",
      codigo: detail.producto?.codigo || detail.tipoLinea || "",
      cantidad: detail.cantidad,
      precioUnitario: detail.precioUnitario,
      total: detail.subtotal,
    })),
  );

const closingNotesFrom = (report: SalesHistoryReport) =>
  (report.cierres || []).map((cierre) => ({
    seller: cierre.usuario?.nombre || "Vendedor",
    branch: branchNameFrom(cierre),
    note: cierre.notas?.trim() || "Sin nota registrada al cerrar caja.",
  }));

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
  const closingNotes = closingNotesFrom(report);
  const saleDetailRows = saleDetailRowsFrom(report);
  const rows: Array<{ kind: "section" | "summary" | "saleDetail" | "expense" | "note"; cells: string[] }> = [
    { kind: "section", cells: ["Resumen de caja"] },
    { kind: "summary", cells: ["Ventas en efectivo", money(report.totals.totalEfectivo || 0)] },
    { kind: "summary", cells: ["Ventas por QR", money(report.totals.totalQr || 0)] },
    { kind: "summary", cells: ["Total ventas EFECTIVO + QR", money((report.totals.totalEfectivo || 0) + (report.totals.totalQr || 0))] },
    { kind: "summary", cells: ["Gastos en efectivo", money(report.totals.gastoEfectivo || 0)] },
    { kind: "summary", cells: ["Gastos por QR", money(report.totals.gastoQr || 0)] },
    { kind: "summary", cells: ["Total gastos", money(report.totals.totalGastos || 0)] },
    { kind: "summary", cells: ["Queda en efectivo despues de gastos", money(remainingCashAfterExpenses(report))] },
    { kind: "summary", cells: ["Queda en QR despues de gastos", money(remainingQrAfterExpenses(report))] },
    { kind: "section", cells: ["Nota del vendedor al cerrar caja"] },
    ...(closingNotes.length
      ? closingNotes.map((item) => ({
          kind: "note" as const,
          cells: [item.seller, item.branch, item.note],
        }))
      : [{
          kind: "note" as const,
          cells: ["Vendedor", sucursal, "Sin cierre de caja registrado para este dia."],
        }]),
    { kind: "section", cells: ["Detalle de ventas del vendedor"] },
    ...saleDetailRows.map((item) => ({
      kind: "saleDetail" as const,
      cells: [
        new Date(item.fecha).toLocaleString("es-BO"),
        item.vendedor,
        item.pago,
        item.codigo,
        String(item.cantidad),
        item.producto,
        money(item.total),
      ],
    })),
    { kind: "section", cells: ["Detalle de gastos"] },
    ...(report.gastos || []).map((expense) => ({
      kind: "expense" as const,
      cells: [
        new Date(expense.createdAt).toLocaleString("es-BO"),
        expense.usuario?.nombre || "Usuario",
        expense.motivo,
        expense.metodoPago,
        money(expense.monto),
      ],
    })),
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
      ["Efectivo", money(report.totals.totalEfectivo || 0)],
      ["QR", money(report.totals.totalQr || 0)],
      ["Total ventas", money(report.totals.totalVentas)],
      ["Gastos", money(report.totals.totalGastos || 0)],
      ["Queda efectivo", money(remainingCashAfterExpenses(report))],
      ["Queda QR", money(remainingQrAfterExpenses(report))],
    ];
    stats.forEach(([label, value], index) => {
      const x = margin + index * 128;
      content += pdfFillRect(x, 470, 120, 34, "0.96 0.97 0.98");
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
      if (row.cells[0].startsWith("Resumen") || row.cells[0].startsWith("Nota")) {
        y -= 26;
        return;
      }
      y -= 24;
      if (row.cells[0].startsWith("Detalle de ventas")) {
        page += pdfText("Fecha", 36, y + 4, 7, true);
        page += pdfText("Vendedor", 155, y + 4, 7, true);
        page += pdfText("Pago", 255, y + 4, 7, true);
        page += pdfText("Codigo", 320, y + 4, 7, true);
        page += pdfText("Cant.", 375, y + 4, 7, true);
        page += pdfText("Producto", 430, y + 4, 7, true);
        page += pdfText("Total", 720, y + 4, 7, true);
      } else {
        page += pdfText("Fecha", 36, y + 4, 7, true);
        page += pdfText("Vendedor", 160, y + 4, 7, true);
        page += pdfText("Detalle del gasto", 285, y + 4, 7, true);
        page += pdfText("Pago", 610, y + 4, 7, true);
        page += pdfText("Monto", 700, y + 4, 7, true);
      }
      y -= rowHeight;
      return;
    }

    page += pdfLine(margin, y - 3, pageWidth - margin, y - 3);
    if (row.kind === "summary") {
      page += pdfText(fitPdfText(row.cells[0], 28), 42, y + 3, 8, true);
      page += pdfText(fitPdfText(row.cells[1], 112), 210, y + 3, 8);
    } else if (row.kind === "note") {
      const boxHeight = Math.max(22, 14 + noteLines.length * 10);
      page += pdfFillRect(margin, y - boxHeight + 6, pageWidth - margin * 2, boxHeight, "0.98 0.98 0.98");
      page += pdfText(`Nota del vendedor - ${row.cells[0]} / ${row.cells[1]}`, margin + 8, y + 1, 8, true);
      noteLines.forEach((line, index) => {
        page += pdfText(line, margin + 8, y - 10 - index * 10, 8);
      });
    } else if (row.kind === "saleDetail") {
      page += pdfText(fitPdfText(row.cells[0], 21), 36, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[1], 18), 155, y + 3, 7);
      page += pdfText(row.cells[2], 255, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[3], 9), 320, y + 3, 7);
      page += pdfText(row.cells[4], 375, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[5], 45), 430, y + 3, 7);
      page += pdfText(row.cells[6], 720, y + 3, 7);
    } else if (row.kind === "expense") {
      page += pdfText(fitPdfText(row.cells[0], 22), 36, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[1], 18), 160, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[2], 44), 285, y + 3, 7);
      page += pdfText(row.cells[3], 610, y + 3, 7);
      page += pdfText(row.cells[4], 700, y + 3, 7);
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
  const saleDetailRows = report ? saleDetailRowsFrom(report) : [];
  const closingNotes = report ? closingNotesFrom(report) : [];

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
              <Stat label="Ventas efectivo" value={money(report.totals.totalEfectivo || 0)} />
              <Stat label="Ventas QR" value={money(report.totals.totalQr || 0)} />
              <Stat label="Total ventas" value={money(report.totals.totalVentas)} />
              <Stat label="Total gastos" value={money(report.totals.totalGastos || 0)} />
              <Stat label="Queda efectivo" value={money(remainingCashAfterExpenses(report))} />
              <Stat label="Queda QR" value={money(remainingQrAfterExpenses(report))} />
              <Stat label="Unidades" value={String(report.totals.unidadesVendidas)} />
              <Stat label="Descuento" value={money(report.totals.descuento)} />
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Resumen de caja</h3>
              <div className="grid gap-3 lg:grid-cols-4">
                <SummaryCard
                  label="Ventas"
                  title={`${money(report.totals.totalEfectivo || 0)} efectivo`}
                  detail={`${money(report.totals.totalQr || 0)} QR`}
                />
                <SummaryCard
                  label="Gastos"
                  title={`${money(report.totals.gastoEfectivo || 0)} efectivo`}
                  detail={`${money(report.totals.gastoQr || 0)} QR`}
                />
                <SummaryCard
                  label="Queda despues de gastos"
                  title={`${money(remainingCashAfterExpenses(report))} efectivo`}
                  detail={`${money(remainingQrAfterExpenses(report))} QR`}
                />
                <SummaryCard
                  label="Nota"
                  title={closingNotes.length > 0 ? `${closingNotes.length} cierre(s)` : "Sin cierre"}
                  detail="La nota del vendedor aparece debajo."
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Nota del vendedor al cerrar caja</h3>
              <div className="space-y-2">
                {closingNotes.length > 0 ? (
                  closingNotes.map((item, index) => (
                    <div key={`${item.seller}-${index}`} className="rounded border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100 print:border-gray-300 print:bg-gray-50 print:text-gray-800">
                      <p className="font-bold print:text-gray-950">{item.seller} / {item.branch}</p>
                      <p className="mt-1">{item.note}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded border border-gray-700 bg-grafito-900 p-3 text-sm text-gray-300 print:border-gray-300 print:bg-gray-50 print:text-gray-800">
                    Sin cierre de caja registrado para este dia.
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-white print:text-gray-950">Detalle de ventas del vendedor</h3>
              <table className="w-full text-left text-sm">
                <thead className="bg-grafito-800 text-gray-300 print:bg-gray-100 print:text-gray-900">
                  <tr>
                    <th className="col-date p-3">Fecha</th>
                    <th className="col-seller p-3">Vendedor</th>
                    <th className="col-payment p-3">Pago</th>
                    <th className="col-code p-3">Codigo</th>
                    <th className="col-product p-3">Producto</th>
                    <th className="col-qty p-3 text-right">Cantidad</th>
                    <th className="col-total p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-200">
                  {saleDetailRows.map((item) => (
                    <tr key={item.id}>
                      <td className="p-3">{new Date(item.fecha).toLocaleString("es-BO")}</td>
                      <td className="p-3">{item.vendedor}</td>
                      <td className="p-3 font-bold">{item.pago}</td>
                      <td className="p-3 font-mono">{item.codigo}</td>
                      <td className="p-3">
                        <p className="font-semibold">{item.producto}</p>
                        <p className="print-muted text-xs text-gray-500 print:text-gray-600">{money(item.precioUnitario)} unit.</p>
                      </td>
                      <td className="p-3 text-right">{item.cantidad}</td>
                      <td className="p-3 text-right">{money(item.total)}</td>
                    </tr>
                  ))}
                  {saleDetailRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-500">Sin ventas en este periodo.</td>
                    </tr>
                  )}
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
                    <th className="p-3">Detalle del gasto</th>
                    <th className="p-3">Pago</th>
                    <th className="p-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-200">
                  {(report.gastos || []).map((expense) => (
                    <tr key={expense.id}>
                      <td className="p-3">{new Date(expense.createdAt).toLocaleString("es-BO")}</td>
                      <td className="p-3">{expense.usuario?.nombre || "Usuario"}</td>
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
                      <td colSpan={5} className="p-4 text-center text-gray-500">Sin gastos en este periodo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>
    </section>
  );
}

function SummaryCard({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div className="print-card rounded-lg border border-gray-700 bg-grafito-900 p-4 print:border-gray-300 print:bg-white">
      <p className="print-muted text-xs uppercase text-gray-500 print:text-gray-600">{label}</p>
      <p className="print-strong mt-1 text-lg font-black text-white print:text-gray-950">{title}</p>
      <p className="print-muted mt-1 text-sm text-gray-400 print:text-gray-700">{detail}</p>
    </div>
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
