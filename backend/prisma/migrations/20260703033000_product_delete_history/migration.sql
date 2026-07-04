CREATE TABLE "ProductoEliminacionHistorial" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "sucursalId" TEXT,
    "usuarioId" TEXT,
    "motivo" TEXT NOT NULL,
    "stockAnterior" INTEGER NOT NULL DEFAULT 0,
    "estadoAnterior" "ProductStatus" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoEliminacionHistorial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductoEliminacionHistorial_productoId_idx" ON "ProductoEliminacionHistorial"("productoId");
CREATE INDEX "ProductoEliminacionHistorial_sucursalId_idx" ON "ProductoEliminacionHistorial"("sucursalId");
CREATE INDEX "ProductoEliminacionHistorial_createdAt_idx" ON "ProductoEliminacionHistorial"("createdAt");

ALTER TABLE "ProductoEliminacionHistorial" ADD CONSTRAINT "ProductoEliminacionHistorial_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductoEliminacionHistorial" ADD CONSTRAINT "ProductoEliminacionHistorial_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductoEliminacionHistorial" ADD CONSTRAINT "ProductoEliminacionHistorial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
