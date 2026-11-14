import { test } from 'node:test';
import assert from 'node:assert/strict';
import { salesReportPdfBytes, saleDetailRowsFrom } from '../src/utils/salesReport';
import type { SalesHistoryReport } from '../src/services/reports';

const report = {
 period: 'day', label: '2026-10-30', totals: { cantidadVentas: 1, totalVentas: 230, totalEfectivo: 230 }, cierres: [], gastos: [],
 ventas: [{ id: '11111111-test', createdAt: '2026-10-31T22:40:18Z', fechaNegocio: '2026-10-30T04:00:00Z', esCorreccionCierre: true, motivoCorreccion: 'subir venta', subtotal: 200, descuento: 0, total: 200, metodoPago: 'EFECTIVO', tipoVenta: 'CONTADO', usuario: { nombre: 'Vendedor de prueba' }, detalles: [{ id: 'line', cantidad: 2, precioUnitario: 100, subtotal: 200, descripcion: 'Reten Scania Moderno Trasera 08323' }] }],
} as unknown as SalesHistoryReport;

test('screen rows retain both business and registration dates with correction reason', () => {
 const [row] = saleDetailRowsFrom(report);
 assert.equal(row.fechaNegocio, '2026-10-30T04:00:00Z');
 assert.equal(row.fecha, '2026-10-31T22:40:18Z');
 assert.equal(row.motivoCorreccion, 'subir venta');
 assert.equal(row.correccion, true);
 assert.equal(row.cantidad, 2);
});

test('downloaded PDF identifies original business date, later registration and correction reason', () => {
 const pdf = new TextDecoder().decode(salesReportPdfBytes(report, 'Santa Cruz'));
 assert.ok(pdf.startsWith('%PDF-1.4'));
 assert.match(pdf, /Correccion de cierre/);
 assert.match(pdf, /Caja: 30\/10\/2026/);
 assert.match(pdf, /Registrada: 31\/10\/2026/);
 assert.match(pdf, /Motivo: subir venta/);
 assert.match(pdf, /Reten Scania/);
 assert.match(pdf, /startxref\n\d+\n%%EOF/);
});

test('ordinary sales do not receive a correction label', () => {
 const plain = { ...report, ventas: report.ventas.map(s => ({ ...s, esCorreccionCierre: false })) };
 assert.doesNotMatch(new TextDecoder().decode(salesReportPdfBytes(plain, 'Santa Cruz')), /Correccion de cierre/);
});
