CREATE TABLE "ProductoStockSucursal" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoStockSucursal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductoStockSucursal_productoId_sucursalId_key" ON "ProductoStockSucursal"("productoId", "sucursalId");
CREATE INDEX "ProductoStockSucursal_sucursalId_idx" ON "ProductoStockSucursal"("sucursalId");

ALTER TABLE "ProductoStockSucursal" ADD CONSTRAINT "ProductoStockSucursal_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductoStockSucursal" ADD CONSTRAINT "ProductoStockSucursal_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ProductoStockSucursal" ("id", "productoId", "sucursalId", "stock", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text), "id", "sucursalId", "stock", CURRENT_TIMESTAMP
FROM "Producto"
ON CONFLICT ("productoId", "sucursalId") DO NOTHING;
