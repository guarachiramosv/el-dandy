import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

let prisma: any, inventory: any, sales: any, products: any, purchases: any, remachado: any, inventoryTransaction: any, inventoryRequest: any;
let branch: any, otherBranch: any, seller: any, category: any, provider: any;
let pool: Pool;

before(async () => {
  const value = process.env.TEST_DATABASE_URL;
  assert.ok(value, 'TEST_DATABASE_URL is required; these tests never use the application database');
  const url = new URL(value);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/inventory_test', 'Only the isolated local inventory_test database is allowed');
  process.env.DATABASE_URL = value;
  pool = new Pool({ connectionString: value });
  const constraints = await pool.query("SELECT 1 FROM pg_constraint WHERE conname='Producto_stock_nonnegative_finite'");
  if (!constraints.rowCount) {
    // db push builds the current schema; apply the actual new migration to that baseline.
    await pool.query('DROP TABLE "OperacionInventario"');
    await pool.query(await readFile(new URL('../prisma/migrations/20261114093000_inventory_safety/migration.sql', import.meta.url), 'utf8'));
  }
  ({ prisma } = await import('../src/lib/prisma'));
  const { InventoryService } = await import('../src/services/inventory.service');
  const { SaleService } = await import('../src/services/sale.service');
  const { ProductService } = await import('../src/services/product.service');
  const { PurchaseService } = await import('../src/services/purchase.service');
  const { RemachadoService } = await import('../src/services/remachado.service');
  ({ inventoryTransaction } = await import('../src/lib/inventory-transaction'));
  ({ inventoryRequest } = await import('../src/lib/inventory-request'));
  inventory = new InventoryService(); sales = new SaleService(); products = new ProductService(); purchases = new PurchaseService(); remachado = new RemachadoService();
  branch = await prisma.sucursal.create({ data: { nombre: 'LOCAL TEST A' } });
  otherBranch = await prisma.sucursal.create({ data: { nombre: 'LOCAL TEST B' } });
  seller = await prisma.usuario.create({ data: { nombre: 'LOCAL TEST', email: randomUUID() + '@example.test', password: 'unused-test-account', sucursalId: branch.id } });
  category = await prisma.categoria.create({ data: { nombre: randomUUID() } });
  provider = await prisma.proveedor.create({ data: { nombre: 'LOCAL TEST' } });
});

after(async () => { if (prisma) await prisma.$disconnect(); if (pool) await pool.end(); });

async function product(stock: number, sucursalId = branch.id) {
  return prisma.producto.create({ data: { codigo: randomUUID(), descripcion: 'LOCAL TEST PRODUCT', marca: 'TEST', precioCompra: 5, precioVenta: 10, stock, categoriaId: category.id, sucursalId, stockSucursales: { create: { sucursalId, stock } } } });
}
const sell = (p: any, cantidad = 1) => sales.create({ usuarioId: seller.id, sucursalId: branch.id, metodoPago: 'EFECTIVO', tipoVenta: 'CONTADO', descuento: 0, items: [{ productoId: p.id, cantidad, descuentoItem: 0 }] });
const adjust = (p: any, cantidad: number) => inventory.adjust({ productoId: p.id, sucursalId: branch.id, usuarioId: seller.id, cantidad });
const replay = (key: string, hash: string, work: () => Promise<any>, usuarioId = seller.id) => inventoryRequest.run({ usuarioId, clave: key, hash }, work);
async function stock(p: any) { return (await prisma.producto.findUniqueOrThrow({ where: { id: p.id } })).stock; }

test('database itself rejects negative and nonfinite stock', async () => {
  const p = await product(10);
  for (const value of ['-1', "'NaN'::float8", "'Infinity'::float8"]) {
    await assert.rejects(pool.query(`UPDATE "Producto" SET stock=${value} WHERE id=$1`, [p.id]), /check constraint/);
  }
  await assert.rejects(pool.query('UPDATE "ProductoStockSucursal" SET stock=-1 WHERE "productoId"=$1', [p.id]), /check constraint/);
  assert.equal(await stock(p), 10);
});

test('simultaneous transactions cannot overwrite a stock snapshot', async () => {
  const p = await product(10);
  let reads = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => release = resolve);
  const work = (delta: number) => inventoryTransaction(async (tx: any) => {
    const previous = await tx.producto.findUniqueOrThrow({ where: { id: p.id } });
    if (++reads === 2) release();
    await barrier;
    await tx.producto.update({ where: { id: p.id }, data: { stock: previous.stock + delta } });
    return delta;
  });
  const results = await Promise.allSettled([work(2), work(3)]);
  const successful = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<number>[];
  assert.equal(successful.length, 1);
  assert.equal(await stock(p), 10 + successful[0].value);
  const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
  assert.equal(rejected.reason.status, 409);
});

test('two simultaneous sales of the last unit produce one sale and one stock movement', async () => {
  const p = await product(1);
  const results = await Promise.allSettled([sell(p), sell(p)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await stock(p), 0);
  assert.equal(await prisma.movimientoStock.count({ where: { productoId: p.id, tipoMovimiento: 'VENTA' } }), 1);
  assert.equal((await prisma.productoStockSucursal.findFirst({ where: { productoId: p.id } })).stock, 0);
});

test('replayed simultaneous operation commits stock and audit exactly once', async () => {
  const p = await product(10); const key = randomUUID();
  const [a, b] = await Promise.all([replay(key, 'same-body', () => adjust(p, -1)), replay(key, 'same-body', () => adjust(p, -1))]);
  assert.equal(a.id, b.id);
  assert.equal(await stock(p), 9);
  assert.equal(await prisma.movimientoStock.count({ where: { productoId: p.id } }), 1);
  assert.equal(await prisma.productoAuditoria.count({ where: { productoId: p.id } }), 1);
  const again = await replay(key, 'same-body', () => adjust(p, -1));
  assert.equal(again.id, a.id);
  assert.equal(await stock(p), 9);
  await assert.rejects(replay(key, 'different-body', () => adjust(p, -5)), (e: any) => e.status === 409);
  assert.equal(await stock(p), 9);
});

test('transaction failure rolls back stock, movement and replay marker together', async () => {
  const p = await product(10); const key = randomUUID();
  await assert.rejects(replay(key, 'rollback', () => inventoryTransaction(async (tx: any) => {
    await tx.producto.update({ where: { id: p.id }, data: { stock: 7 } });
    await tx.movimientoStock.create({ data: { productoId: p.id, sucursalId: branch.id, usuarioId: seller.id, tipoMovimiento: 'AJUSTE', stockAnterior: 10, stockNuevo: 7, cantidad: -3 } });
    throw new Error('forced failure');
  })), /forced failure/);
  assert.equal(await stock(p), 10);
  assert.equal(await prisma.movimientoStock.count({ where: { productoId: p.id } }), 0);
  assert.equal(await prisma.operacionInventario.count({ where: { usuarioId: seller.id, clave: key } }), 0);
});

test('stale product form cannot restore stock sold after the form opened', async () => {
  const p = await product(10); await sell(p);
  await assert.rejects(products.update(p.id, { stock: 12, stockEsperado: 10, descripcion: 'stale edit' }, seller.id), (e: any) => e.status === 409);
  assert.equal(await stock(p), 9);
  assert.equal((await prisma.producto.findUnique({ where: { id: p.id } })).descripcion, 'LOCAL TEST PRODUCT');
  await assert.rejects(products.update(p.id, { stock: 10 }, seller.id), (e: any) => e.status === 409);
  await products.update(p.id, { descripcion: 'metadata edit' }, seller.id);
  assert.equal(await stock(p), 9);
  await products.update(p.id, { stock: 11, stockEsperado: 9 }, seller.id);
  assert.equal(await stock(p), 11);
});

test('seller cannot consume another branch or an inactive product', async () => {
  const foreign = await product(5, otherBranch.id);
  await assert.rejects(sell(foreign), (e: any) => e.status === 409);
  assert.equal(await stock(foreign), 5);
  const disabled = await product(5);
  await prisma.producto.update({ where: { id: disabled.id }, data: { activo: false, estado: 'INACTIVO' } });
  await assert.rejects(sell(disabled), (e: any) => e.status === 409);
  assert.equal(await stock(disabled), 5);
});

test('negative adjustment and fractions of unit products leave stock unchanged', async () => {
  const p = await product(2);
  await assert.rejects(adjust(p, -3), (e: any) => e.status === 400);
  await assert.rejects(sell(p, 0.5), (e: any) => e.status === 400);
  assert.equal(await stock(p), 2);
  assert.equal(await prisma.movimientoStock.count({ where: { productoId: p.id } }), 0);
});

test('simultaneous annulments refund once and use the original remachado branch', async () => {
  const p = await product(3, otherBranch.id);
  const sale = await prisma.venta.create({ data: { usuarioId: seller.id, sucursalId: branch.id, subtotal: 20, total: 20, metodoPago: 'EFECTIVO', detalles: { create: { productoId: p.id, cantidad: 2, precioUnitario: 10, subtotal: 20 } } } });
  await prisma.movimientoStock.create({ data: { productoId: p.id, sucursalId: otherBranch.id, usuarioId: seller.id, tipoMovimiento: 'VENTA', stockAnterior: 5, stockNuevo: 3, cantidad: -2, referenciaTipo: 'REMACHADO', referenciaId: sale.id } });
  const results = await Promise.allSettled([sales.deleteSale(sale.id, 'test refund', seller.id), sales.deleteSale(sale.id, 'test refund', seller.id)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await stock(p), 5);
  assert.equal(await prisma.movimientoStock.count({ where: { productoId: p.id, referenciaTipo: 'ANULACION' } }), 1);
  assert.equal((await prisma.productoStockSucursal.findFirst({ where: { productoId: p.id } })).sucursalId, otherBranch.id);
});

test('simultaneous transfers conserve stock and cannot overspend the source', async () => {
  const p = await product(1);
  await prisma.productoStockSucursal.create({ data: { productoId: p.id, sucursalId: otherBranch.id, stock: 0 } });
  const move = () => inventory.transfer({ productoOrigenId: p.id, productoDestinoId: p.id, sucursalOrigenId: branch.id, sucursalDestinoId: otherBranch.id, cantidad: 1, usuarioId: seller.id });
  const results = await Promise.allSettled([move(), move()]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await stock(p), 1);
  const branches = await prisma.productoStockSucursal.findMany({ where: { productoId: p.id } });
  assert.equal(branches.find((b: any) => b.sucursalId === branch.id).stock, 0);
  assert.equal(branches.find((b: any) => b.sucursalId === otherBranch.id).stock, 1);
  assert.equal(await prisma.movimientoStock.count({ where: { productoId: p.id } }), 2);
});

test('purchase on inactive branch rolls back purchase, debt and stock', async () => {
  const p = await product(2);
  await prisma.productoStockSucursal.updateMany({ where: { productoId: p.id }, data: { activo: false, estado: 'INACTIVO' } });
  const previousCount = await prisma.compra.count();
  await assert.rejects(purchases.create({ proveedorId: provider.id, sucursalId: branch.id, usuarioId: seller.id, montoPagado: 0, fechaVencimiento: '2099-01-01', items: [{ productoId: p.id, cantidad: 3, precioUnitario: 5 }] }), (e: any) => e.status === 409);
  assert.equal(await prisma.compra.count(), previousCount);
  assert.equal(await stock(p), 2);
  assert.equal((await prisma.proveedor.findUnique({ where: { id: provider.id } })).deudaPendiente, 0);
});

test('remachado refuses deductions beyond available stock', async () => {
  const measure = await remachado.createMedida({ medida: randomUUID(), stockJuegos: 1, precioJuego: 10, precioMedioJuego: 5 }, seller.id);
  await assert.rejects(remachado.adjustMedidaStock(measure.id, { cantidadJuegos: -2, usuarioId: seller.id }), (e: any) => e.status === 400);
  assert.equal((await prisma.remachadoMedida.findUnique({ where: { id: measure.id } })).stockJuegos, 1);
});
