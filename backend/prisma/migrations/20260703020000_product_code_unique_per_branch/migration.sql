DROP INDEX "Producto_codigo_key";

CREATE UNIQUE INDEX "Producto_codigo_sucursalId_key" ON "Producto"("codigo", "sucursalId");
