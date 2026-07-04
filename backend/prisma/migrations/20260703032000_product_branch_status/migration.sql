ALTER TABLE "ProductoStockSucursal" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProductoStockSucursal" ADD COLUMN "estado" "ProductStatus" NOT NULL DEFAULT 'ACTIVO';

UPDATE "ProductoStockSucursal" ps
SET "activo" = p."activo",
    "estado" = p."estado"
FROM "Producto" p
WHERE ps."productoId" = p."id";
