BEGIN;
CREATE TABLE "OperacionInventario" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "clave" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "resultado" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperacionInventario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperacionInventario_usuarioId_clave_key" ON "OperacionInventario"("usuarioId", "clave");
CREATE INDEX "OperacionInventario_createdAt_idx" ON "OperacionInventario"("createdAt");
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_stock_nonnegative_finite" CHECK (stock >= 0 AND stock < 'Infinity'::double precision) NOT VALID;
ALTER TABLE "ProductoStockSucursal" ADD CONSTRAINT "ProductoStockSucursal_stock_nonnegative_finite" CHECK (stock >= 0 AND stock < 'Infinity'::double precision) NOT VALID;
ALTER TABLE "RemachadoMedida" ADD CONSTRAINT "RemachadoMedida_stock_nonnegative_finite" CHECK ("stockJuegos" >= 0 AND "stockJuegos" < 'Infinity'::double precision) NOT VALID;
ALTER TABLE "RemachadoRemache" ADD CONSTRAINT "RemachadoRemache_stock_nonnegative" CHECK (stock >= 0) NOT VALID;
ALTER TABLE "Producto" VALIDATE CONSTRAINT "Producto_stock_nonnegative_finite";
ALTER TABLE "ProductoStockSucursal" VALIDATE CONSTRAINT "ProductoStockSucursal_stock_nonnegative_finite";
ALTER TABLE "RemachadoMedida" VALIDATE CONSTRAINT "RemachadoMedida_stock_nonnegative_finite";
ALTER TABLE "RemachadoRemache" VALIDATE CONSTRAINT "RemachadoRemache_stock_nonnegative";
COMMIT;
