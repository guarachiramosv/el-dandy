import type { PaymentMethod, Product } from './types';

export type ReceiptSaleDetail = {
  id?: string;
  tipoLinea?: 'PRODUCTO' | 'REMACHADO';
  descripcion?: string | null;
  unidadVenta?: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  producto?: Product;
};

export type ReceiptSale = {
  id: string;
  subtotal: number;
  descuento: number;
  total: number;
  metodoPago: PaymentMethod;
  tipoVenta: 'CONTADO' | 'CREDITO';
  createdAt?: string;
  usuario?: { nombre?: string | null } | null;
  sucursal?: { nombre?: string | null } | null;
  cliente?: { nombre?: string | null; nit?: string | null } | null;
  detalles?: ReceiptSaleDetail[];
};

const TICKET_WIDTH = 40;
const DESCRIPTION_WIDTH = 20;
const QTY_WIDTH = 5;
const SUBTOTAL_WIDTH = 13;

const money = (value: number) =>
  `${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BOB`;

const moneyShort = (value: number) =>
  `Bs ${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const repeat = (char: string) => char.repeat(TICKET_WIDTH);

const normalizeText = (value: string | number | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (value: string, width: number) =>
  value.length > width ? `${value.slice(0, Math.max(width - 1, 0))}.` : value;

const center = (value: string) => {
  const text = truncate(normalizeText(value), TICKET_WIDTH);
  const left = Math.floor((TICKET_WIDTH - text.length) / 2);
  return `${' '.repeat(Math.max(left, 0))}${text}`;
};

const lineBetween = (left: string, right: string) => {
  const cleanLeft = normalizeText(left);
  const cleanRight = normalizeText(right);
  const spaces = Math.max(TICKET_WIDTH - cleanLeft.length - cleanRight.length, 1);
  return `${cleanLeft}${' '.repeat(spaces)}${cleanRight}`.slice(0, TICKET_WIDTH);
};

const formatDateParts = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const day = String(safeDate.getDate()).padStart(2, '0');
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const year = safeDate.getFullYear();
  const hours = String(safeDate.getHours()).padStart(2, '0');
  const minutes = String(safeDate.getMinutes()).padStart(2, '0');
  return { date: `${day}/${month}/${year}`, time: `${hours}:${minutes}` };
};

const formatSaleNumber = (saleId: string) => {
  const digits = saleId.replace(/\D/g, '');
  if (digits) return digits.slice(-7).padStart(7, '0');
  return normalizeText(saleId).replace(/[^a-zA-Z0-9]/g, '').slice(-7).padStart(7, '0').toUpperCase();
};

const wrapText = (value: string, width: number) => {
  const words = normalizeText(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

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
  return lines.length ? lines : [''];
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const salePaymentLabel = (tipoVenta: 'CONTADO' | 'CREDITO', metodoPago: PaymentMethod) =>
  tipoVenta === 'CREDITO' ? 'CREDITO' : metodoPago;

const brandLogoHtml = () => `
  <svg class="brand-logo" viewBox="0 0 280 78" role="img" aria-label="Repuestos Diesel Dandy">
    <g transform="translate(13 12)">
      <circle cx="24" cy="24" r="21" fill="none" stroke="#000" stroke-width="5"/>
      <circle cx="24" cy="24" r="12" fill="none" stroke="#000" stroke-width="4"/>
      <g fill="#000">
        <rect x="21" y="-2" width="6" height="10" rx="1"/>
        <rect x="21" y="40" width="6" height="10" rx="1"/>
        <rect x="-2" y="21" width="10" height="6" rx="1"/>
        <rect x="40" y="21" width="10" height="6" rx="1"/>
      </g>
      <g transform="translate(18 12) rotate(-28 16 22)">
        <rect x="8" y="0" width="23" height="19" rx="2" fill="#000"/>
        <rect x="13" y="18" width="6" height="28" rx="2" fill="#000"/>
        <circle cx="16" cy="48" r="7" fill="none" stroke="#000" stroke-width="5"/>
      </g>
    </g>
    <text x="72" y="23" fill="#000" font-family="Arial Black, Impact, sans-serif" font-size="17" font-weight="900">REPUESTOS</text>
    <text x="72" y="50" fill="#000" font-family="Arial Black, Impact, sans-serif" font-size="26" font-weight="900">DIESEL DANDY</text>
    <text x="74" y="67" fill="#000" font-family="Arial, sans-serif" font-size="10" font-weight="900">CALIDAD Y CONFIANZA</text>
  </svg>
`;

const quantityLabel = (value: number, unit?: string | null, tipoLinea?: string | null) => {
  if (tipoLinea === 'REMACHADO' || unit === 'MEDIO_JUEGO' || unit === 'JUEGO') {
    if (value === 0.5) return '1/2';
    if (value === 1) return '1';
  }
  const quantity = value.toLocaleString('es-BO', { maximumFractionDigits: 2 });
  if (unit === 'METRO') return `${quantity} m`;
  return quantity;
};

function buildTicketText(sale: ReceiptSale, fallbackSellerName = '') {
  const details = sale.detalles || [];
  const { date, time } = formatDateParts(sale.createdAt);
  const lines = [
    repeat('='),
    center('EL DANDY'),
    repeat('='),
    lineBetween(`Fecha: ${date}`, `Hora: ${time}`),
    `Nro. Nota: ${formatSaleNumber(sale.id)}`,
    `Atendido por: ${normalizeText(sale.usuario?.nombre || fallbackSellerName || 'Vendedor')}`,
    `Metodo: ${salePaymentLabel(sale.tipoVenta, sale.metodoPago)}`,
    repeat('-'),
    `${'DESCRIPCION'.padEnd(DESCRIPTION_WIDTH)} ${'CANT.'.padStart(QTY_WIDTH)} ${'SUBTOTAL'.padStart(SUBTOTAL_WIDTH)}`,
    repeat('-'),
  ];

  details.forEach((detail) => {
    const description = detail.producto?.descripcion || detail.descripcion || detail.producto?.codigo || 'Detalle de venta';
    const descriptionLines = wrapText(description, DESCRIPTION_WIDTH);
    descriptionLines.forEach((descriptionLine, index) => {
      const quantity = index === 0 ? String(detail.cantidad).padStart(QTY_WIDTH) : ' '.repeat(QTY_WIDTH);
      const subtotal = index === 0 ? money(detail.subtotal).padStart(SUBTOTAL_WIDTH) : ' '.repeat(SUBTOTAL_WIDTH);
      lines.push(`${truncate(descriptionLine, DESCRIPTION_WIDTH).padEnd(DESCRIPTION_WIDTH)} ${quantity} ${subtotal}`);
    });
  });

  lines.push(
    '',
    repeat('-'),
    lineBetween('TOTAL A PAGAR:', money(sale.total)),
    repeat('='),
    center('* NOTA DE VENTA - SIN VALOR FISCAL *'),
    center('Gracias por su preferencia!'),
    repeat('='),
  );

  return lines.join('\n');
}

export function buildThermalReceiptHtml(sale: ReceiptSale, fallbackSellerName = '') {
  const saleReceiptCopyHtml = () => {
    const details = sale.detalles || [];
    const { date, time } = formatDateParts(sale.createdAt);
    const sellerName = sale.usuario?.nombre || fallbackSellerName || 'Vendedor';
    const customerName = sale.cliente?.nombre || 'Cliente ocasional';
    const customerNit = sale.cliente?.nit;
    const branchName = sale.sucursal?.nombre || 'Sucursal';
    const paymentLabel = salePaymentLabel(sale.tipoVenta, sale.metodoPago);
    const rows = details.map((detail) => {
      const product = detail.producto;
      const description = product?.descripcion || detail.descripcion || 'Detalle de venta';
      const unit = detail.unidadVenta || product?.unidadVenta;

      return `
        <tr>
          <td class="item-description">
            <strong>${escapeHtml(description)}</strong>
          </td>
          <td class="numeric">${escapeHtml(quantityLabel(detail.cantidad, unit, detail.tipoLinea))}</td>
          <td class="numeric">${escapeHtml(moneyShort(detail.precioUnitario))}</td>
          <td class="numeric strong">${escapeHtml(moneyShort(detail.subtotal))}</td>
        </tr>
      `;
    }).join('');

    return `
      <section class="receipt-copy">
        <header class="brand-header">
          ${brandLogoHtml()}
        </header>
        <div class="meta-grid">
          <div><span>Fecha</span><strong>${escapeHtml(date)} ${escapeHtml(time)}</strong></div>
          <div><span>Cliente</span><strong>${escapeHtml(customerName)}</strong></div>
          <div><span>NIT/CI</span><strong>${escapeHtml(customerNit || '-')}</strong></div>
          <div><span>Vendedor</span><strong>${escapeHtml(sellerName)}</strong></div>
          <div><span>Pago</span><strong>${escapeHtml(paymentLabel)}</strong></div>
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
          <p>Sin valor fiscal</p>
          <p class="thanks">Gracias por su preferencia.</p>
        </footer>
      </section>
    `;
  };

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page {
        size: 70mm auto;
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
        width: 70mm;
      }
      .receipt-copy {
        width: 70mm;
        margin: 0;
        padding: 2mm 1.2mm 5mm;
        page-break-after: always;
        color: #000;
        font-weight: 700;
      }
      .receipt-copy:last-child {
        page-break-after: auto;
      }
      .brand-header {
        border-top: 1.5px solid #000;
        border-bottom: 1.5px solid #000;
        padding: 1mm 0 1mm;
        text-align: center;
      }
      .brand-logo {
        display: block;
        width: 63mm;
        height: 17mm;
        margin: 0 auto;
      }
      p {
        margin: 0;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1mm;
        margin-top: 1.5mm;
      }
      .meta-grid div {
        border: 1px solid #000;
        padding: 1mm;
      }
      .meta-grid span,
      .item-description span,
      footer {
        display: block;
        color: #000;
        font-size: 7.5px;
        font-weight: 700;
      }
      .meta-grid strong {
        display: block;
        margin-top: 0.3mm;
        font-size: 9px;
        font-weight: 900;
      }
      table {
        width: 100%;
        margin-top: 2mm;
        border-collapse: collapse;
        table-layout: fixed;
      }
      th {
        border-top: 2px solid #111;
        border-bottom: 2px solid #111;
        padding: 1mm 0.35mm;
        font-size: 7.6px;
        font-weight: 900;
        text-align: left;
        text-transform: uppercase;
      }
      th:first-child {
        width: 43%;
      }
      th:nth-child(2) {
        width: 11%;
      }
      th:nth-child(3), td:nth-child(3) {
        width: 21%;
      }
      th:nth-child(4), td:nth-child(4) {
        width: 25%;
      }
      td {
        border-bottom: 1px solid #000;
        padding: 1.3mm 0.35mm;
        vertical-align: top;
        overflow-wrap: anywhere;
        font-size: 8.8px;
        font-weight: 800;
      }
      .item-description strong {
        display: block;
        font-size: 9.2px;
        font-weight: 900;
      }
      .numeric {
        text-align: right;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .strong {
        font-weight: 900;
      }
      .empty {
        padding: 4mm 0;
        text-align: center;
        color: #777;
      }
      .summary {
        margin-top: 2.5mm;
        border: 1.5px solid #111;
      }
      .summary div {
        display: flex;
        justify-content: space-between;
        gap: 2mm;
        padding: 1.3mm 1.7mm;
        border-bottom: 1px solid #000;
        font-size: 9.5px;
      }
      .summary div:last-child {
        border-bottom: 0;
      }
      .grand-total {
        background: #fff;
        color: #000;
        font-size: 12px;
        font-weight: 900;
      }
      footer {
        margin-top: 2.5mm;
        text-align: center;
      }
      .thanks {
        margin-top: 1mm;
        color: #000;
        font-weight: 800;
      }
      .signature {
        margin-top: 8mm;
        border-top: 2px solid #111;
        padding-top: 1mm;
        color: #000;
        font-size: 10px;
      }
    </style>
  </head>
  <body>
    ${saleReceiptCopyHtml()}
  </body>
</html>`;
}
