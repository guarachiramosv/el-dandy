import type { Product, Sucursal } from '../types';

export type PurchaseDraft = {
  currency: 'BOB' | 'BRL'; price: string; exchangeRate: string;
  providerId: string; receipt: string; notes: string;
};
export const emptyPurchase: PurchaseDraft = { currency: 'BOB', price: '', exchangeRate: '', providerId: '', receipt: '', notes: '' };
export const decimal = (value: string) => value.trim() === '' ? NaN : Number(value.replace(',', '.'));
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function purchaseCost(draft: PurchaseDraft) {
  const price = decimal(draft.price);
  const exchangeRate = draft.currency === 'BRL' ? decimal(draft.exchangeRate) : 0;
  return { unitBs: round(draft.currency === 'BRL' ? price * exchangeRate : price), unitReales: draft.currency === 'BRL' ? price : 0, exchangeRate };
}

export function validatePurchase(draft: PurchaseDraft) {
  if (!Number.isFinite(decimal(draft.price)) || decimal(draft.price) <= 0) return 'Indica un costo unitario de compra mayor a cero.';
  if (draft.currency === 'BRL' && (!Number.isFinite(decimal(draft.exchangeRate)) || decimal(draft.exchangeRate) <= 0)) return 'Indica cuantos bolivianos equivale 1 real.';
  const cost = purchaseCost(draft);
  if (!Number.isFinite(cost.unitBs) || cost.unitBs <= 0) return 'El costo convertido a Bs debe ser mayor a cero.';
  return '';
}

export function purchaseFromProduct(product: Product): PurchaseDraft {
  const inReales = (product.precioCompraReales || 0) > 0;
  return { ...emptyPurchase, currency: inReales ? 'BRL' : 'BOB', price: String(inReales ? product.precioCompraReales : product.precioCompra ?? ''), exchangeRate: String(product.tipoCambioCompra || ''), providerId: product.proveedorId || '' };
}

export function branchStocks(product: Product, branches: Sucursal[]) {
  const all = new Map(branches.map(branch => [branch.id, branch]));
  product.stockSucursales?.forEach(row => { if (!all.has(row.sucursalId)) all.set(row.sucursalId, { id: row.sucursalId, nombre: row.sucursal?.nombre || 'Sucursal' }); });
  if (!all.has(product.sucursalId)) all.set(product.sucursalId, { id: product.sucursalId, nombre: product.sucursal?.nombre || 'Sucursal' });
  return Array.from(all.values()).map(branch => {
    const row = product.stockSucursales?.find(item => item.sucursalId === branch.id);
    const legacy = !product.stockSucursales?.length && product.sucursalId === branch.id;
    return { id: branch.id, nombre: branch.nombre, stock: row?.stock ?? (legacy ? product.stock : 0), ubicacion: row?.ubicacion || (branch.id === product.sucursalId ? product.ubicacion : '') || '', registered: !!row || legacy, active: row ? row.activo !== false && (!row.estado || row.estado === 'ACTIVO') : legacy };
  });
}

export function availableTotal(product: Product) {
  if (!product.stockSucursales?.length) return product.stock;
  return product.stockSucursales.reduce((sum, row) => sum + (row.activo !== false && (!row.estado || row.estado === 'ACTIVO') ? row.stock : 0), 0);
}
