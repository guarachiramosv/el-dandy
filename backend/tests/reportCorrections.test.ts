import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { ReportService } from '../src/services/report.service';
import { SaleService } from '../src/services/sale.service';
import { createSaleSchema, closeCashRegisterSchema } from '../src/validators/saleValidator';

const sale = { id: 'corrected-sale', fechaNegocio: new Date('2026-10-30T04:00:00Z'), createdAt: new Date('2026-10-31T22:40:18Z'), total: 230, subtotal: 231, descuento: 1, tipoVenta: 'CONTADO', metodoPago: 'EFECTIVO', esCorreccionCierre: true, motivoCorreccion: 'subir venta', sucursalId: 'branch', sucursal: { nombre: 'Santa Cruz' }, usuario: { nombre: 'Vendedor de prueba', sucursal: { nombre: 'Santa Cruz' } }, detalles: [{ productoId: 'retener', cantidad: 2, subtotal: 200, costoUnitario: 90, producto: { id: 'retener', codigo: '0045', descripcion: 'Reten Scania', precioCompra: 90 } }], pagos: [] };

test('corrected sale belongs to business day and retains registration date and correction metadata', async () => {
  const originals = [prisma.venta.findMany, prisma.gastoCaja.findMany, prisma.cierreCaja.findMany];
  (prisma.venta as any).findMany = async ({ where }: any) => sale.fechaNegocio >= where.fechaNegocio.gte && sale.fechaNegocio < where.fechaNegocio.lt ? [sale] : [];
  (prisma.gastoCaja as any).findMany = async () => [];
  (prisma.cierreCaja as any).findMany = async () => [];
  try {
    const service = new ReportService();
    const r = await service.getSalesHistoryReport({ period: 'day', value: '2026-10-30' });
    assert.equal(r.totals.totalVentas, 230);
    assert.equal(r.productosVendidos[0]?.cantidad, 2);
    assert.equal(r.ventas[0]?.esCorreccionCierre, true);
    assert.equal(r.ventas[0]?.createdAt.toISOString(), '2026-10-31T22:40:18.000Z');
    assert.equal(r.ventas[0]?.motivoCorreccion, 'subir venta');
    assert.equal((await service.getSalesHistoryReport({ period: 'day', value: '2026-10-31' })).ventas.length, 0);
    assert.equal((await service.getSalesHistoryReport({ period: 'month', value: '2026-10' })).totals.totalVentas, 230);
    assert.equal((await service.getSalesHistoryReport({ period: 'year', value: '2026' })).totals.totalVentas, 230);
  } finally {
    [prisma.venta.findMany, prisma.gastoCaja.findMany, prisma.cierreCaja.findMany] = originals as any;
  }
});

test('profit report groups corrections by business day, including cross-month registrations', async () => {
  const originals = [prisma.venta.findMany, prisma.gastoCaja.findMany, prisma.pagoCredito.findMany, prisma.movimientoFinanciero.findMany];
  (prisma.venta as any).findMany = async () => [{ ...sale, createdAt: new Date('2026-11-01T14:00:00Z') }];
  (prisma.gastoCaja as any).findMany = async () => [{ monto: 10, fechaNegocio: sale.fechaNegocio, createdAt: new Date('2026-11-01T15:00:00Z'), sucursalId: 'branch', sucursal: sale.sucursal }];
  (prisma.pagoCredito as any).findMany = async () => [];
  (prisma.movimientoFinanciero as any).findMany = async () => [];
  try {
    const r = await new ReportService().getMonthlyProfitReport({ month: '2026-10' });
    assert.equal(r.dias.length, 1);
    assert.equal(r.dias[0]?.fecha, '2026-10-30');
    assert.equal(r.dias[0]?.ingresos, 230);
    assert.equal(r.dias[0]?.gastos, 10);
  } finally {
    [prisma.venta.findMany, prisma.gastoCaja.findMany, prisma.pagoCredito.findMany, prisma.movimientoFinanciero.findMany] = originals as any;
  }
});

for (const value of ['2026-02-30', '2026-04-31', '2026-13-01', '2026-10-30-extra']) {
  test(`report rejects invalid calendar date ${value}`, async () => {
    await assert.rejects(new ReportService().getSalesHistoryReport({ period: 'day', value }), (e: any) => e.status === 400);
  });
}

test('sale correction requires observed closing owned by seller, branch and day', async () => {
  const original = prisma.$transaction;
  let query: any;
  let authorized = false;
  const stop = new Error('inventory reached');
  const tx = { cierreCaja: { findFirst: async ({ where }: any) => { query = where; return authorized ? { id: 'closing', estado: 'OBSERVADO' } : null; } }, producto: { findMany: async () => { throw stop; } } };
  (prisma as any).$transaction = async (fn: any) => fn(tx);
  const input = { usuarioId: 'seller', sucursalId: 'branch', metodoPago: 'EFECTIVO' as const, tipoVenta: 'CONTADO' as const, descuento: 0, items: [{ productoId: 'product', cantidad: 2, descuentoItem: 0 }], fechaNegocio: '2026-10-30', cierreCorregidoId: 'closing', motivoCorreccion: 'subir venta' };
  try {
    const service = new SaleService();
    await assert.rejects(service.create({ ...input, motivoCorreccion: '' }), /explica la correccion/);
    await assert.rejects(service.create(input), /no esta observado/);
    assert.deepEqual(query, { id: 'closing', usuarioId: 'seller', sucursalId: 'branch', fecha: new Date('2026-10-30T04:00:00Z'), estado: 'OBSERVADO' });
    authorized = true;
    await assert.rejects(service.create(input), e => e === stop);
    await assert.rejects(service.create({ ...input, fechaNegocio: '2099-01-01' }), /fecha futura/);
  } finally { (prisma as any).$transaction = original; }
});

test('sales and closing validation rejects impossible dates and negative amounts', () => {
  assert.equal(closeCashRegisterSchema.safeParse({ fecha: '2026-02-30', montoDeclarado: 0 }).success, false);
  const input = { usuarioId: '11111111-1111-4111-8111-111111111111', sucursalId: '22222222-2222-4222-8222-222222222222', metodoPago: 'EFECTIVO', fechaNegocio: '2026-02-30', items: [{ productoId: '33333333-3333-4333-8333-333333333333', cantidad: 2 }] };
  assert.equal(createSaleSchema.safeParse(input).success, false);
  assert.equal(createSaleSchema.safeParse({ ...input, fechaNegocio: '2026-10-30', items: [{ ...input.items[0], cantidad: -2 }] }).success, false);
  assert.equal(createSaleSchema.safeParse({ ...input, fechaNegocio: '2026-10-30', items: [input.items[0], input.items[0]] }).success, false);
});
