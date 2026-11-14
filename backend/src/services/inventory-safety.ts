type BranchStock = { sucursalId: string; stock: number; activo: boolean; estado: string };
type SaleStockProduct = { sucursalId: string; stock: number; activo: boolean; estado: string; stockSucursales: BranchStock[] };

export function resolveSaleStock(producto: SaleStockProduct, sucursalId: string) {
  if (!producto.activo || producto.estado !== 'ACTIVO') {
    throw Object.assign(new Error('El producto esta inactivo o descontinuado. No se puede vender.'), { status: 409 });
  }
  const branch = producto.stockSucursales.find(item => item.sucursalId === sucursalId);
  if (branch?.activo && branch.estado === 'ACTIVO') return { sucursalId, availableStock: branch.stock };
  throw Object.assign(new Error('El producto no tiene inventario activo en la sucursal de la venta. Solicita una transferencia al administrador.'), { status: 409 });
}

export function requireValidStock(stock: number) {
  if (!Number.isFinite(stock) || stock < 0) {
    throw Object.assign(new Error('La operacion dejaria un stock negativo o invalido. No se modifico el inventario.'), { status: 400 });
  }
  return stock;
}

export function requireQuantityForUnit(quantity: number, unidadVenta: string) {
  if (!Number.isFinite(quantity) || Math.abs(quantity) > Number.MAX_SAFE_INTEGER || (unidadVenta === 'UNIDAD' && !Number.isSafeInteger(quantity))) {
    throw Object.assign(new Error('Los productos por unidad requieren cantidades enteras.'), { status: 400 });
  }
}
