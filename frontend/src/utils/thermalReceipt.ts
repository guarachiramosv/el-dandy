import type { PaymentMethod, Sale } from "../types";

const TICKET_WIDTH = 40;
const DESCRIPTION_WIDTH = 20;
const QTY_WIDTH = 5;
const SUBTOTAL_WIDTH = 13;

const money = (value: number) =>
  `${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BOB`;

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

function buildTicketText(sale: Sale, fallbackSellerName = "") {
  const details = sale.detalles || [];
  const { date, time } = formatDateParts(sale.createdAt);
  const lines = [
    repeat("="),
    center("EL DANDY"),
    repeat("="),
    lineBetween(`Fecha: ${date}`, `Hora: ${time}`),
    `Nro. Nota: ${formatSaleNumber(sale.id)}`,
    `Atendido por: ${normalizeText(sale.usuario?.nombre || fallbackSellerName || "Vendedor")}`,
    `Metodo: ${salePaymentLabel(sale.tipoVenta, sale.metodoPago)}`,
    repeat("-"),
    `${"DESCRIPCION".padEnd(DESCRIPTION_WIDTH)} ${"CANT.".padStart(QTY_WIDTH)} ${"SUBTOTAL".padStart(SUBTOTAL_WIDTH)}`,
    repeat("-"),
  ];

  details.forEach((detail) => {
    const description = detail.producto?.descripcion || detail.descripcion || detail.producto?.codigo || "Detalle de venta";
    const descriptionLines = wrapText(description, DESCRIPTION_WIDTH);
    descriptionLines.forEach((descriptionLine, index) => {
      const quantity = index === 0 ? detail.cantidad.toLocaleString("es-BO", { maximumFractionDigits: 2 }).padStart(QTY_WIDTH) : " ".repeat(QTY_WIDTH);
      const subtotal = index === 0 ? money(detail.subtotal).padStart(SUBTOTAL_WIDTH) : " ".repeat(SUBTOTAL_WIDTH);
      lines.push(`${truncate(descriptionLine, DESCRIPTION_WIDTH).padEnd(DESCRIPTION_WIDTH)} ${quantity} ${subtotal}`);
    });
  });

  lines.push(
    "",
    repeat("-"),
    lineBetween("TOTAL A PAGAR:", money(sale.total)),
    repeat("="),
    center("* NOTA DE VENTA - SIN VALOR FISCAL *"),
    center("Gracias por su preferencia!"),
    repeat("="),
  );

  return lines.join("\n");
}

export function buildThermalReceiptHtml(sale: Sale, fallbackSellerName = "") {
  const ticketText = buildTicketText(sale, fallbackSellerName);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Ticket ${escapeHtml(sale.id)}</title>
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
    <pre class="ticket">${escapeHtml(ticketText)}</pre>
    <script>
      window.addEventListener("load", () => {
        window.focus();
        window.print();
      });
    </script>
  </body>
</html>`;
}
