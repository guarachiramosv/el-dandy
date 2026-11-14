import type { ReportPeriod, SalesHistoryReport } from "../services/reports";

export const money = (value: number) => `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const branchNameFrom = (item: { usuario?: { sucursal?: { nombre: string } }; sucursal?: { nombre: string } }) =>
  item.usuario?.sucursal?.nombre || item.sucursal?.nombre || "Sucursal";

export const businessDate = (value: string) => new Date(value).toLocaleDateString("es-BO", { timeZone: "America/La_Paz" });
export const registeredAt = (value: string) => new Date(value).toLocaleString("es-BO", { timeZone: "America/La_Paz" });

const salePaymentLabel = (tipoVenta: string, metodoPago: string) =>
  tipoVenta === "CREDITO" ? "CREDITO" : metodoPago;

export const remainingCashAfterExpenses = (report: SalesHistoryReport) =>
  Math.max((report.totals.totalEfectivo || 0) + (report.totals.cobroCreditoEfectivo || 0) - (report.totals.gastoEfectivo || 0), 0);

export const remainingQrAfterExpenses = (report: SalesHistoryReport) =>
  Math.max((report.totals.totalQr || 0) + (report.totals.cobroCreditoQr || 0) - (report.totals.gastoQr || 0), 0);

export const saleDetailRowsFrom = (report: SalesHistoryReport) =>
  report.ventas.flatMap((sale) => {
    const details = sale.detalles || [];
    const grossTotal = details.reduce((sum, detail) => sum + detail.precioUnitario * detail.cantidad, 0);
    const totalDiscount = Math.max(grossTotal - sale.total, 0);
    return details.map((detail, index) => {
      return {
        id: `${sale.id}-${detail.id}`,
        ventaId: sale.id,
        fecha: sale.createdAt,
        fechaNegocio: sale.fechaNegocio,
        correccion: sale.esCorreccionCierre,
        motivoCorreccion: sale.motivoCorreccion,
        vendedor: sale.usuario?.nombre || "Usuario",
        sucursal: branchNameFrom(sale),
        pago: salePaymentLabel(sale.tipoVenta, sale.metodoPago),
        producto: detail.producto?.descripcion || detail.descripcion || "Detalle",
        codigo: detail.producto?.codigo || detail.tipoLinea || "",
        cantidad: detail.cantidad,
        precioUnitario: detail.precioUnitario,
        subtotal: detail.subtotal,
        isLast: index === details.length - 1,
        saleSubtotal: grossTotal,
        saleDiscount: totalDiscount,
        saleTotal: sale.total,
      };
    });
  });

export const closingNotesFrom = (report: SalesHistoryReport) =>
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

export function valueForPeriod(period: ReportPeriod, day: string, month: string, year: string) {
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

export const salesReportPdfBytes = (report: SalesHistoryReport, sucursal: string) => {
  const pageWidth = 792;
  const pageHeight = 612;
  const margin = 30;
  const bottom = 34;
  const rowHeight = 18;
  const pages: string[] = [];
  const closingNotes = closingNotesFrom(report);
  const saleDetailRows = saleDetailRowsFrom(report);
  const rows: Array<{ kind: "section" | "summary" | "saleDetail" | "saleSummary" | "expense" | "note" | "correction"; cells: string[] }> = [
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
    ...saleDetailRows.flatMap((item) => [
      {
        kind: "saleDetail" as const,
        cells: [
          businessDate(item.fechaNegocio || item.fecha),
          item.vendedor,
          item.pago,
          item.codigo,
          String(item.cantidad),
          item.producto,
          money(item.subtotal),
        ],
      },
      ...(item.isLast && item.correccion ? [{
        kind: "correction" as const,
        cells: [`Correccion de cierre | Caja: ${businessDate(item.fechaNegocio || item.fecha)} | Registrada: ${registeredAt(item.fecha)} | Venta ${item.ventaId.slice(0, 8)}. Motivo: ${item.motivoCorreccion || "Sin motivo registrado"}`],
      }] : []),
      ...(item.isLast ? [{
        kind: "saleSummary" as const,
        cells: [
          `Subtotal: ${money(item.saleSubtotal)}   Descuento: ${money(item.saleDiscount)}   Total cobrado: ${money(item.saleTotal)}`,
        ],
      }] : []),
    ]),
    { kind: "section", cells: ["Detalle de gastos"] },
    ...(report.gastos || []).map((expense) => ({
      kind: "expense" as const,
      cells: [
        businessDate(expense.fechaNegocio || expense.createdAt),
        expense.usuario?.nombre || "Usuario",
        expense.motivo,
        expense.metodoPago,
        money(expense.monto),
      ],
    })),
  ];

  const drawHeader = (pageNumber: number) => {
    let content = "";
    content += pdfText("Reporte diario de ventas", margin, 576, 16, true);
    content += pdfText(`Periodo: ${report.label}`, margin, 558, 9);
    content += pdfText(`Sucursal: ${sucursal}`, margin, 544, 9);
    content += pdfText(`Generado: ${registeredAt(new Date().toISOString())}`, margin, 530, 9);
    content += pdfText(`Pagina ${pageNumber}`, 710, 576, 9, true);

    const statGap = 6;
    const statWidth = (pageWidth - margin * 2 - statGap * 6) / 7;
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
      const x = margin + index * (statWidth + statGap);
      content += pdfFillRect(x, 486, statWidth, 34, "0.96 0.97 0.98");
      content += pdfText(label, x + 7, 505, 7, true);
      content += pdfText(value, x + 7, 492, 8, true);
    });
    content += pdfLine(margin, 474, pageWidth - margin, 474);
    return content;
  };

  let page = drawHeader(1);
  let y = 454;
  let pageNumber = 1;

  const newPage = () => {
    pages.push(page);
    pageNumber += 1;
    page = drawHeader(pageNumber);
    y = 454;
  };

  rows.forEach((row) => {
    const noteLines = row.kind === "note" ? wrapPdfText(row.cells[2], 118) : [];
    const correctionLines = row.kind === "correction" ? wrapPdfText(row.cells[0], 125) : [];
    const neededHeight = row.kind === "section" ? rowHeight : rowHeight + (noteLines.length + correctionLines.length) * 10;
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
        page += pdfText("Vendedor", 145, y + 4, 7, true);
        page += pdfText("Pago", 235, y + 4, 7, true);
        page += pdfText("Codigo", 295, y + 4, 7, true);
        page += pdfText("Cant.", 345, y + 4, 7, true);
        page += pdfText("Producto", 390, y + 4, 7, true);
        page += pdfText("Subtotal", 700, y + 4, 7, true);
      } else {
        page += pdfText("Fecha", 36, y + 4, 7, true);
        page += pdfText("Vendedor", 155, y + 4, 7, true);
        page += pdfText("Detalle del gasto", 280, y + 4, 7, true);
        page += pdfText("Pago", 600, y + 4, 7, true);
        page += pdfText("Monto", 690, y + 4, 7, true);
      }
      y -= rowHeight;
      return;
    }

    page += pdfLine(margin, y - 3, pageWidth - margin, y - 3);
    if (row.kind === "summary") {
      page += pdfText(fitPdfText(row.cells[0], 42), 42, y + 3, 8, true);
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
      page += pdfText(fitPdfText(row.cells[1], 16), 145, y + 3, 7);
      page += pdfText(row.cells[2], 235, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[3], 9), 295, y + 3, 7);
      page += pdfText(row.cells[4], 345, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[5], 50), 390, y + 3, 7);
      page += pdfText(row.cells[6], 710, y + 3, 7);
    } else if (row.kind === "correction") {
      correctionLines.forEach((line, index) => {
        page += pdfText(line, 42, y + 3 - index * 10, 8);
      });
      y -= Math.max(rowHeight, correctionLines.length * 10 + 8);
      return;
    } else if (row.kind === "saleSummary") {
      page += pdfFillRect(margin, y - 3, pageWidth - margin * 2, 17, "0.96 0.97 0.98");
      page += pdfText(row.cells[0], 42, y + 3, 8, true);
    } else if (row.kind === "expense") {
      page += pdfText(fitPdfText(row.cells[0], 22), 36, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[1], 18), 155, y + 3, 7);
      page += pdfText(fitPdfText(row.cells[2], 44), 280, y + 3, 7);
      page += pdfText(row.cells[3], 600, y + 3, 7);
      page += pdfText(row.cells[4], 690, y + 3, 7);
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
