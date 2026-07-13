ALTER TABLE "RemachadoTrabajo"
ADD COLUMN "resorteProductoId" TEXT,
ADD COLUMN "cantidadResortes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "gomaProductoId" TEXT,
ADD COLUMN "cantidadGomas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "seguroProductoId" TEXT,
ADD COLUMN "cantidadSeguros" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "RemachadoTrabajo_resorteProductoId_idx" ON "RemachadoTrabajo"("resorteProductoId");
CREATE INDEX "RemachadoTrabajo_gomaProductoId_idx" ON "RemachadoTrabajo"("gomaProductoId");
CREATE INDEX "RemachadoTrabajo_seguroProductoId_idx" ON "RemachadoTrabajo"("seguroProductoId");

ALTER TABLE "RemachadoTrabajo" ADD CONSTRAINT "RemachadoTrabajo_resorteProductoId_fkey" FOREIGN KEY ("resorteProductoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RemachadoTrabajo" ADD CONSTRAINT "RemachadoTrabajo_gomaProductoId_fkey" FOREIGN KEY ("gomaProductoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RemachadoTrabajo" ADD CONSTRAINT "RemachadoTrabajo_seguroProductoId_fkey" FOREIGN KEY ("seguroProductoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
