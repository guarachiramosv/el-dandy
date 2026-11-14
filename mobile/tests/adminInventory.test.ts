import { test } from 'node:test';
import assert from 'node:assert/strict';
import { branchStocks, availableTotal, emptyPurchase, purchaseCost, purchaseFromProduct, validatePurchase } from '../src/domain/adminInventory';
import { addProductStockSchema, createProductSchema } from '../../backend/src/validators/productValidator';
import type { Product } from '../src/types';

const branches = [{ id: 'cbba', nombre: 'Cochabamba' }, { id: 'scz', nombre: 'Santa Cruz' }];
const item = { id: 'p', sucursalId: 'scz', stock: 4, precioVenta: 100, descripcion: 'Producto', stockSucursales: [{ id: 'row', sucursalId: 'scz', stock: 4, activo: true, estado: 'ACTIVO' }] } as Product;

test('both branches remain visible when one has never had inventory', () => {
 const rows = branchStocks(item,branches);
 assert.deepEqual(rows.map(row=>[row.nombre,row.stock]),[['Cochabamba',0],['Santa Cruz',4]]);
 assert.equal(rows[0].registered,false);
 assert.equal(rows[1].registered,true);
});

test('branch filtering does not turn branch stock into the overall available total', () => {
 const product = {...item, stock:3, stockSucursales:[...item.stockSucursales!,{id:'other',sucursalId:'cbba',stock:7,activo:true,estado:'ACTIVO' as const}]};
 assert.equal(availableTotal(product),11);
 assert.deepEqual(branchStocks(product,branches).map(row=>row.stock),[7,4]);
});

test('inactive physical stock is labeled separately and excluded from available total', () => {
 const product = {...item,stockSucursales:[...item.stockSucursales!,{id:'other',sucursalId:'cbba',stock:7,activo:false,estado:'INACTIVO' as const}]};
 assert.equal(availableTotal(product),4);
 const row=branchStocks(product,branches)[0];
 assert.equal(row.stock,7);assert.equal(row.active,false);
});

test('reales purchase converts a unit cost and satisfies the existing stock API contract', () => {
 const draft = {...emptyPurchase,currency:'BRL' as const,price:'100,50',exchangeRate:'1,5'};
 assert.equal(validatePurchase(draft),'');
 const cost=purchaseCost(draft);
 assert.equal(cost.unitBs,150.75);assert.equal(cost.unitReales,100.5);assert.equal(cost.exchangeRate,1.5);
 const parsed=addProductStockSchema.parse({sucursalId:'22222222-2222-4222-8222-222222222222',cantidad:2,precioCompraUnitario:cost.unitBs,precioCompraUnitarioReales:cost.unitReales,tipoCambio:cost.exchangeRate});
 assert.equal(parsed.cantidad*parsed.precioCompraUnitario,301.5);
});

test('bolivianos purchase clears previous reales and exchange rate', () => {
 const cost=purchaseCost({...emptyPurchase,currency:'BOB',price:'75,25',exchangeRate:'1.5'});
 assert.deepEqual(cost,{unitBs:75.25,unitReales:0,exchangeRate:0});
});

test('purchase validation rejects missing or invalid cost and conversion rate', () => {
 for(const price of ['', '-1', 'texto', 'Infinity']) assert.ok(validatePurchase({...emptyPurchase,price}));
 for(const exchangeRate of ['', '0', '-2', 'texto']) assert.ok(validatePurchase({...emptyPurchase,currency:'BRL',price:'10',exchangeRate}));
});

test('editing preserves original purchase currency and rate', () => {
 const draft=purchaseFromProduct({...item,precioCompra:150.75,precioCompraReales:100.5,tipoCambioCompra:1.5});
 assert.equal(draft.currency,'BRL');assert.equal(draft.price,'100.5');assert.equal(draft.exchangeRate,'1.5');
});

test('initial purchase in reales is accepted by the product creation contract', () => {
 const cost=purchaseCost({...emptyPurchase,currency:'BRL',price:'20',exchangeRate:'1.5'});
 const result=createProductSchema.parse({descripcion:'Producto prueba',marca:'Prueba',stock:3,precioCompra:cost.unitBs,precioVenta:50,categoriaId:'11111111-1111-4111-8111-111111111111',sucursalId:'22222222-2222-4222-8222-222222222222',compraInicial:{cantidad:3,proveedorId:null,precioCompraUnitario:cost.unitBs,precioCompraUnitarioReales:cost.unitReales,tipoCambio:cost.exchangeRate}});
 assert.equal(result.compraInicial?.precioCompraUnitario,30);
 assert.equal(result.compraInicial?.precioCompraUnitarioReales,20);
});
