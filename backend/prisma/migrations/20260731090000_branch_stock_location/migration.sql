ALTER TABLE "ProductoStockSucursal" ADD COLUMN "ubicacion" TEXT;

UPDATE "ProductoStockSucursal" ps
SET "ubicacion" = p."ubicacion"
FROM "Producto" p
WHERE ps."productoId" = p."id"
  AND ps."ubicacion" IS NULL;
