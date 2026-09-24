ALTER TABLE "DetalleVenta"
ADD COLUMN "costoUnitario" DOUBLE PRECISION;

UPDATE "DetalleVenta" AS detalle
SET "costoUnitario" = producto."precioCompra"
FROM "Producto" AS producto
WHERE detalle."productoId" = producto."id"
  AND detalle."costoUnitario" IS NULL;
