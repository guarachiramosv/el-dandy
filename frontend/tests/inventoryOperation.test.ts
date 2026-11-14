import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareInventoryOperation, completeInventoryOperation } from '../src/utils/inventoryOperation';
import { resolveAvailableStock } from '../src/components/pos/posDomain';

const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };

test('simultaneous writes share a replay key, failed requests retain it, success permits a new sale', async () => {
 const payload = { items: [{ productoId: 'example', cantidad: 2 }] };
 const [a,b] = await Promise.all([prepareInventoryOperation('POST','/sales',payload,'actor',storage),prepareInventoryOperation('POST','/sales',payload,'actor',storage)]);
 assert.ok(a && b); assert.equal(a.key,b.key);
 const retry = await prepareInventoryOperation('POST','/sales',payload,'actor',storage);
 assert.equal(retry?.key,a.key);
 completeInventoryOperation(a,storage);
 const next = await prepareInventoryOperation('POST','/sales',payload,'actor',storage);
 assert.notEqual(next?.key,a.key);
 completeInventoryOperation(next,storage);
});

test('reads and uploads do not become inventory operations', async () => {
 assert.equal(await prepareInventoryOperation('GET','/products',undefined,'actor',storage),null);
 assert.equal(await prepareInventoryOperation('POST','/upload/products/id/images',new FormData(),'actor',storage),null);
});

test('sales screen does not fall back to another branch or inactive stock', () => {
 const product = { stock: 20, sucursalId: 'other', activo: true, estado: 'ACTIVO', stockSucursales: [{ sucursalId:'other',stock:20,activo:true,estado:'ACTIVO' }] } as any;
 assert.equal(resolveAvailableStock(product,'seller-branch'),0);
 assert.equal(resolveAvailableStock(product,'other'),20);
 assert.equal(resolveAvailableStock({...product,activo:false},'other'),0);
});
