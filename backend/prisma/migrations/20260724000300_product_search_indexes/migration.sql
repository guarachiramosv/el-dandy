CREATE INDEX "Producto_estado_createdAt_idx" ON "Producto"("estado", "createdAt");
CREATE INDEX "Producto_sucursalId_estado_idx" ON "Producto"("sucursalId", "estado");
CREATE INDEX "Producto_codigo_idx" ON "Producto"("codigo");
CREATE INDEX "Producto_codigoRepuesto_idx" ON "Producto"("codigoRepuesto");
