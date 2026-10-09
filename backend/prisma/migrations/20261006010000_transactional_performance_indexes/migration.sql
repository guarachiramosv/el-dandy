-- Indexes for the most frequent transactional filters and dashboard/report ranges.
-- PostgreSQL creates these without changing application data.
CREATE INDEX "Cliente_createdAt_idx" ON "Cliente"("createdAt");
CREATE INDEX "Producto_stock_idx" ON "Producto"("stock");

CREATE INDEX "Venta_createdAt_idx" ON "Venta"("createdAt");
CREATE INDEX "Venta_sucursalId_createdAt_idx" ON "Venta"("sucursalId", "createdAt");
CREATE INDEX "Venta_usuarioId_sucursalId_createdAt_idx" ON "Venta"("usuarioId", "sucursalId", "createdAt");
CREATE INDEX "Venta_clienteId_createdAt_idx" ON "Venta"("clienteId", "createdAt");

CREATE INDEX "DetalleVenta_ventaId_idx" ON "DetalleVenta"("ventaId");
CREATE INDEX "DetalleVenta_productoId_idx" ON "DetalleVenta"("productoId");

CREATE INDEX "Compra_createdAt_idx" ON "Compra"("createdAt");
CREATE INDEX "Compra_sucursalId_createdAt_idx" ON "Compra"("sucursalId", "createdAt");
CREATE INDEX "Compra_proveedorId_createdAt_idx" ON "Compra"("proveedorId", "createdAt");

CREATE INDEX "MovimientoStock_createdAt_idx" ON "MovimientoStock"("createdAt");
CREATE INDEX "CuentaCobrar_clienteId_estado_idx" ON "CuentaCobrar"("clienteId", "estado");
CREATE INDEX "CuentaCobrar_sucursalId_estado_idx" ON "CuentaCobrar"("sucursalId", "estado");
CREATE INDEX "PagoCredito_usuarioId_createdAt_idx" ON "PagoCredito"("usuarioId", "createdAt");
CREATE INDEX "PagoCredito_cuentaId_createdAt_idx" ON "PagoCredito"("cuentaId", "createdAt");
