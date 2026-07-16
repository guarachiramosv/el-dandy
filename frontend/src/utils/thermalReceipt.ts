import type { DailySalesSummary, PaymentMethod, Sale } from "../types";

const TICKET_WIDTH = 40;

const money = (value: number) =>
  `${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BOB`;

const moneyShort = (value: number) =>
  `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const repeat = (char: string) => char.repeat(TICKET_WIDTH);

const normalizeText = (value: string | number | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const truncate = (value: string, width: number) =>
  value.length > width ? value.slice(0, Math.max(width - 1, 0)) + "." : value;

const center = (value: string) => {
  const text = truncate(normalizeText(value), TICKET_WIDTH);
  const left = Math.floor((TICKET_WIDTH - text.length) / 2);
  return `${" ".repeat(Math.max(left, 0))}${text}`;
};

const lineBetween = (left: string, right: string) => {
  const cleanLeft = normalizeText(left);
  const cleanRight = normalizeText(right);
  const spaces = Math.max(TICKET_WIDTH - cleanLeft.length - cleanRight.length, 1);
  return `${cleanLeft}${" ".repeat(spaces)}${cleanRight}`.slice(0, TICKET_WIDTH);
};

const formatDateParts = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const day = String(safeDate.getDate()).padStart(2, "0");
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const year = safeDate.getFullYear();
  const hours = String(safeDate.getHours()).padStart(2, "0");
  const minutes = String(safeDate.getMinutes()).padStart(2, "0");
  return { date: `${day}/${month}/${year}`, time: `${hours}:${minutes}` };
};

const formatSaleNumber = (saleId: string) => {
  const digits = saleId.replace(/\D/g, "");
  if (digits) return digits.slice(-7).padStart(7, "0");
  return normalizeText(saleId).replace(/[^a-zA-Z0-9]/g, "").slice(-7).padStart(7, "0").toUpperCase();
};

const wrapText = (value: string, width: number) => {
  const words = normalizeText(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    if (word.length > width) {
      if (current) lines.push(current);
      lines.push(word.slice(0, width));
      current = word.slice(width);
      return;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const salePaymentLabel = (tipoVenta: "CONTADO" | "CREDITO", metodoPago: PaymentMethod) =>
  tipoVenta === "CREDITO" ? "CREDITO" : metodoPago;

const productConditionLabel = (condition?: string | null) => condition === "USADO" ? "Usado" : "Nuevo";

const quantityLabel = (value: number, unit?: string | null) => {
  const quantity = value.toLocaleString("es-BO", { maximumFractionDigits: 2 });
  if (unit === "METRO") return `${quantity} m`;
  return quantity;
};

function buildCashClosingText(
  summary: DailySalesSummary,
  fallbackSellerName = "",
  options: { declaredCash?: number; notes?: string | null } = {},
) {
  const closing = summary.cierre;
  const { time } = formatDateParts(closing?.createdAt);
  const grossCash = summary.totals.totalEfectivo || 0;
  const grossQr = summary.totals.totalQr || 0;
  const expenses = summary.gastos?.totals || { totalGastos: 0, totalEfectivo: 0, totalQr: 0 };
  const netCash = closing?.netoEfectivo ?? summary.netos?.totalEfectivo ?? Math.max(grossCash - expenses.totalEfectivo, 0);
  const netQr = closing?.netoQr ?? summary.netos?.totalQr ?? Math.max(grossQr - expenses.totalQr, 0);
  const declaredCash = closing?.montoDeclarado ?? options.declaredCash ?? netCash;
  const difference = closing?.diferencia ?? declaredCash - netCash;
  const notes = normalizeText(closing?.notas || options.notes || "");

  const lines = [
    repeat("="),
    center("EL DANDY"),
    center("CIERRE DE CAJA"),
    repeat("="),
    lineBetween(`Fecha: ${summary.fecha}`, `Hora: ${time}`),
    `Vendedor: ${normalizeText(fallbackSellerName || "Vendedor")}`,
    `Estado: ${summary.cerrado ? "CERRADO" : "PRECIERRE"}`,
    repeat("-"),
    lineBetween("Ventas:", String(summary.totals.cantidadVentas || 0)),
    lineBetween("Total ventas:", money(summary.totals.totalVentas || 0)),
    lineBetween("Efectivo venta:", money(grossCash)),
    lineBetween("Gastos efectivo:", `-${money(expenses.totalEfectivo || 0)}`),
    lineBetween("EFECTIVO CIERRE:", money(netCash)),
    lineBetween("QR venta:", money(grossQr)),
    lineBetween("Gastos QR:", `-${money(expenses.totalQr || 0)}`),
    lineBetween("QR CIERRE:", money(netQr)),
    lineBetween("Transferencia:", money(summary.totals.totalTransferencia || 0)),
    lineBetween("Tarjeta:", money(summary.totals.totalTarjeta || 0)),
    lineBetween("Credito:", money(summary.totals.totalCredito || 0)),
    repeat("-"),
    lineBetween("Contado caja:", money(declaredCash)),
    lineBetween("Diferencia:", money(difference)),
    repeat("-"),
    center("EFECTIVO PARA DEPOSITO"),
    center(money(declaredCash)),
  ];

  if (notes) {
    lines.push(repeat("-"), "Nota:");
    wrapText(notes, TICKET_WIDTH).forEach((line) => lines.push(line));
  }

  lines.push(
    repeat("="),
    center("Firma vendedor"),
    "",
    "____________________________",
    repeat("="),
  );

  return lines.join("\n");
}

function thermalHtml(title: string, text: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      html,
      body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #111;
        font-family: "Courier New", Courier, monospace;
        font-size: 11px;
        line-height: 1.2;
      }
      body {
        width: 80mm;
      }
      .ticket {
        width: 80mm;
        padding: 4mm 3mm 6mm;
        letter-spacing: 0;
        white-space: pre;
      }
      @media print {
        html,
        body,
        .ticket {
          width: 80mm;
        }
      }
    </style>
  </head>
  <body>
    <pre class="ticket">${escapeHtml(text)}</pre>
    <script>
      window.addEventListener("load", () => {
        window.focus();
        window.print();
      });
    </script>
  </body>
</html>`;
}

function saleReceiptCopyHtml(sale: Sale, fallbackSellerName: string, copyLabel: "COPIA CLIENTE" | "COPIA VENDEDOR") {
  const details = sale.detalles || [];
  const { date, time } = formatDateParts(sale.createdAt);
  const sellerName = sale.usuario?.nombre || fallbackSellerName || "Vendedor";
  const customerName = sale.cliente?.nombre || "Cliente ocasional";
  const customerNit = sale.cliente?.nit;
  const branchName = sale.sucursal?.nombre || "Sucursal";
  const paymentLabel = salePaymentLabel(sale.tipoVenta, sale.metodoPago);

  const rows = details.map((detail) => {
    const product = detail.producto;
    const code = product?.codigo || detail.tipoLinea || "";
    const description = product?.descripcion || detail.descripcion || "Detalle de venta";
    const condition = product ? productConditionLabel(product.condicion) : detail.tipoLinea === "REMACHADO" ? "Remachado" : "";
    const unit = detail.unidadVenta || product?.unidadVenta;

    return `
      <tr>
        <td class="item-description">
          <strong>${escapeHtml(description)}</strong>
          <span>${escapeHtml([code, condition].filter(Boolean).join(" - "))}</span>
        </td>
        <td class="numeric">${escapeHtml(quantityLabel(detail.cantidad, unit))}</td>
        <td class="numeric">${escapeHtml(moneyShort(detail.precioUnitario))}</td>
        <td class="numeric strong">${escapeHtml(moneyShort(detail.subtotal))}</td>
      </tr>
    `;
  }).join("");

  return `
    <section class="receipt-copy">
      <header class="brand-header">
        <div class="brand-mark">DD</div>
        <div>
          <p class="eyebrow">Repuestos Diesel</p>
          <h1>DANDY</h1>
          <p class="tagline">Calidad y confianza</p>
        </div>
      </header>

      <div class="copy-badge">${copyLabel}</div>

      <div class="meta-grid">
        <div>
          <span>Nota</span>
          <strong>${escapeHtml(formatSaleNumber(sale.id))}</strong>
        </div>
        <div>
          <span>Fecha</span>
          <strong>${escapeHtml(date)} ${escapeHtml(time)}</strong>
        </div>
        <div>
          <span>Cliente</span>
          <strong>${escapeHtml(customerName)}</strong>
        </div>
        <div>
          <span>NIT/CI</span>
          <strong>${escapeHtml(customerNit || "-")}</strong>
        </div>
        <div>
          <span>Vendedor</span>
          <strong>${escapeHtml(sellerName)}</strong>
        </div>
        <div>
          <span>Pago</span>
          <strong>${escapeHtml(paymentLabel)}</strong>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Detalle</th>
            <th class="numeric">Cant.</th>
            <th class="numeric">P. Unit.</th>
            <th class="numeric">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="4" class="empty">Sin productos.</td></tr>`}
        </tbody>
      </table>

      <div class="summary">
        <div><span>Subtotal</span><strong>${escapeHtml(moneyShort(sale.subtotal || 0))}</strong></div>
        <div><span>Descuento</span><strong>${escapeHtml(moneyShort(sale.descuento || 0))}</strong></div>
        <div class="grand-total"><span>Total</span><strong>${escapeHtml(moneyShort(sale.total))}</strong></div>
      </div>

      <footer>
        <p>${escapeHtml(branchName)} - WhatsApp 76982111</p>
        <p>Nota de venta sin valor fiscal</p>
        ${copyLabel === "COPIA VENDEDOR" ? `<div class="signature">Firma / conformidad</div>` : `<p class="thanks">Gracias por su preferencia.</p>`}
      </footer>
    </section>
  `;
}

function saleReceiptHtml(title: string, copies: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      html,
      body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #111;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 10px;
        line-height: 1.25;
      }
      body {
        width: 80mm;
      }
      .receipt-copy {
        width: 80mm;
        padding: 4mm 3mm 6mm;
        break-after: page;
        page-break-after: always;
      }
      .receipt-copy:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .brand-header {
        display: grid;
        grid-template-columns: 13mm 1fr;
        gap: 2.5mm;
        align-items: center;
        border: 1px solid #111;
        border-bottom: 4px solid #f97316;
        padding: 2.5mm;
        background: #111;
        color: #fff;
      }
      .brand-mark {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 11mm;
        height: 11mm;
        border: 2px solid #f97316;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 900;
      }
      h1,
      p {
        margin: 0;
      }
      h1 {
        color: #f97316;
        font-size: 19px;
        line-height: 1;
        letter-spacing: 0;
      }
      .eyebrow {
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .tagline {
        margin-top: 1mm;
        font-size: 8px;
        text-transform: uppercase;
      }
      .copy-badge {
        margin: 2.5mm 0;
        border: 1px dashed #111;
        padding: 1.5mm;
        text-align: center;
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5mm;
      }
      .meta-grid div {
        border: 1px solid #ddd;
        padding: 1.5mm;
      }
      .meta-grid span,
      .item-description span,
      footer {
        display: block;
        color: #555;
        font-size: 8px;
      }
      .meta-grid strong {
        display: block;
        margin-top: 0.5mm;
        font-size: 9px;
      }
      table {
        width: 100%;
        margin-top: 3mm;
        border-collapse: collapse;
        table-layout: fixed;
      }
      th {
        border-top: 2px solid #111;
        border-bottom: 1px solid #111;
        padding: 1.5mm 0.8mm;
        font-size: 8px;
        text-align: left;
        text-transform: uppercase;
      }
      th:first-child {
        width: 41%;
      }
      th:nth-child(2) {
        width: 16%;
      }
      th:nth-child(3),
      th:nth-child(4) {
        width: 21.5%;
      }
      td {
        border-bottom: 1px solid #e5e5e5;
        padding: 1.8mm 0.8mm;
        vertical-align: top;
        overflow-wrap: anywhere;
      }
      .item-description strong {
        display: block;
        font-size: 9px;
      }
      .numeric {
        text-align: right;
      }
      .strong {
        font-weight: 800;
      }
      .empty {
        padding: 4mm 0;
        text-align: center;
        color: #777;
      }
      .summary {
        margin-top: 3mm;
        border: 1px solid #111;
      }
      .summary div {
        display: flex;
        justify-content: space-between;
        gap: 2mm;
        padding: 1.5mm 2mm;
        border-bottom: 1px solid #ddd;
      }
      .summary div:last-child {
        border-bottom: 0;
      }
      .grand-total {
        background: #111;
        color: #fff;
        font-size: 13px;
        font-weight: 900;
      }
      footer {
        margin-top: 3mm;
        text-align: center;
      }
      .thanks {
        margin-top: 1mm;
        color: #111;
        font-weight: 800;
      }
      .signature {
        margin-top: 8mm;
        border-top: 1px solid #111;
        padding-top: 1mm;
        color: #111;
        font-size: 9px;
      }
      @media print {
        html,
        body,
        .receipt-copy {
          width: 80mm;
        }
      }
    </style>
  </head>
  <body>
    ${copies}
    <script>
      window.addEventListener("load", () => {
        window.focus();
        window.print();
      });
    </script>
  </body>
</html>`;
}

export function buildThermalReceiptHtml(sale: Sale, fallbackSellerName = "") {
  return saleReceiptHtml(
    `Detalle de venta ${sale.id}`,
    [
      saleReceiptCopyHtml(sale, fallbackSellerName, "COPIA CLIENTE"),
      saleReceiptCopyHtml(sale, fallbackSellerName, "COPIA VENDEDOR"),
    ].join(""),
  );
}

export function buildThermalCashClosingHtml(
  summary: DailySalesSummary,
  fallbackSellerName = "",
  options: { declaredCash?: number; notes?: string | null } = {},
) {
  return thermalHtml("Cierre de caja", buildCashClosingText(summary, fallbackSellerName, options));
}
