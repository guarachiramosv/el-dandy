import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPreviousCashClosed, AutomaticCashClosingService, businessDayStart } from '../src/services/cashClosingPolicy.service';

const yesterday = new Date('2026-10-21T04:00:00Z');
const today = new Date('2026-10-22T04:00:00Z');
function database(sales: any[] = [], expenses: any[] = [], payments: any[] = [], closings: any[] = []) {
  return {
    venta: { findMany: async () => sales, count: async () => sales.length },
    gastoCaja: { findMany: async () => expenses, count: async () => expenses.length },
    pagoCredito: { findMany: async () => payments, count: async () => payments.length },
    cierreCaja: { findMany: async () => closings, findFirst: async () => closings[0], create: async ({ data }: any) => { closings.push(data); return data; } },
  };
}
test('Bolivia midnight is 04:00 UTC', () => {
  assert.equal(businessDayStart(new Date('2026-10-22T03:59:59Z')).toISOString(), yesterday.toISOString());
  assert.equal(businessDayStart(today).toISOString(), today.toISOString());
});
for (const kind of ['sale', 'expense', 'payment']) {
  test(`${kind} without closing blocks next day even with zero amount`, async () => {
    const movement = [{ fechaNegocio: yesterday, monto: 0 }];
    const db = database(kind === 'sale' ? movement : [], kind === 'expense' ? movement : [], kind === 'payment' ? movement : []);
    await assert.rejects(assertPreviousCashClosed(db as any, 'seller', 'branch', today), /2026-10-21/);
  });
}
test('sent closing permits next day without admin approval', async () => {
  const db = database([{ fechaNegocio: yesterday }], [], [], [{ fecha: yesterday, estado: 'PENDIENTE' }]);
  await assertPreviousCashClosed(db as any, 'seller', 'branch', today);
});
test('observed closing blocks operations', async () => {
  const db = database([], [], [], [{ fecha: yesterday, estado: 'OBSERVADO' }]);
  await assert.rejects(assertPreviousCashClosed(db as any, 'seller', 'branch', today));
});
for (const hasMovement of [false, true]) {
  test(`automatic reconciliation ${hasMovement ? 'preserves days with activity' : 'closes empty days once'}`, async () => {
    const closings: any[] = [];
    const tx = database(hasMovement ? [{ fechaNegocio: yesterday }] : [], [], [], closings);
    const db = { ...tx, usuario: { findMany: async () => [{ id: 'seller', sucursalId: 'branch', createdAt: yesterday }] }, $transaction: async (fn: any) => fn(tx) };
    const service = new AutomaticCashClosingService(db as any);
    await service.reconcile(today);
    await service.reconcile(today);
    assert.equal(closings.length, hasMovement ? 0 : 1);
    if (!hasMovement) {
      assert.equal(closings[0].montoDeclarado, 0);
      assert.equal(closings[0].estado, 'APROBADO');
      assert.equal(closings[0].historial.create.snapshot.automatico, true);
    }
  });
}
