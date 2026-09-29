ALTER TABLE "Producto"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "MovimientoStock"
ADD COLUMN "proveedorId" TEXT,
ADD COLUMN "precioCompraUnitario" DOUBLE PRECISION,
ADD COLUMN "costoTotal" DOUBLE PRECISION,
ADD COLUMN "estante" TEXT,
ADD COLUMN "comprobante" TEXT;

ALTER TABLE "MovimientoStock"
ADD CONSTRAINT "MovimientoStock_sucursalId_fkey"
FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MovimientoStock"
ADD CONSTRAINT "MovimientoStock_proveedorId_fkey"
FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MovimientoStock_productoId_createdAt_idx" ON "MovimientoStock"("productoId", "createdAt");
CREATE INDEX "MovimientoStock_sucursalId_createdAt_idx" ON "MovimientoStock"("sucursalId", "createdAt");
CREATE INDEX "MovimientoStock_proveedorId_idx" ON "MovimientoStock"("proveedorId");
CREATE INDEX "MovimientoStock_usuarioId_idx" ON "MovimientoStock"("usuarioId");
