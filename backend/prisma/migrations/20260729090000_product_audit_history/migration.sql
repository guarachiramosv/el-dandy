CREATE TYPE "ProductAuditAction" AS ENUM (
  'CREADO',
  'EDITADO',
  'STOCK_AGREGADO',
  'STOCK_AJUSTADO',
  'ESTADO_CAMBIADO',
  'ELIMINADO',
  'RESTAURADO',
  'DESCONTINUADO',
  'TRANSFERIDO'
);

CREATE TABLE "ProductoAuditoria" (
  "id" TEXT NOT NULL,
  "accion" "ProductAuditAction" NOT NULL,
  "productoId" TEXT,
  "codigo" TEXT,
  "descripcion" TEXT,
  "sucursalId" TEXT,
  "usuarioId" TEXT,
  "stockAnterior" DOUBLE PRECISION,
  "stockNuevo" DOUBLE PRECISION,
  "cantidad" DOUBLE PRECISION,
  "estadoAnterior" "ProductStatus",
  "estadoNuevo" "ProductStatus",
  "detalle" TEXT,
  "cambios" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductoAuditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductoAuditoria_productoId_idx" ON "ProductoAuditoria"("productoId");
CREATE INDEX "ProductoAuditoria_sucursalId_idx" ON "ProductoAuditoria"("sucursalId");
CREATE INDEX "ProductoAuditoria_usuarioId_idx" ON "ProductoAuditoria"("usuarioId");
CREATE INDEX "ProductoAuditoria_accion_idx" ON "ProductoAuditoria"("accion");
CREATE INDEX "ProductoAuditoria_createdAt_idx" ON "ProductoAuditoria"("createdAt");

ALTER TABLE "ProductoAuditoria" ADD CONSTRAINT "ProductoAuditoria_productoId_fkey"
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductoAuditoria" ADD CONSTRAINT "ProductoAuditoria_sucursalId_fkey"
  FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductoAuditoria" ADD CONSTRAINT "ProductoAuditoria_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
