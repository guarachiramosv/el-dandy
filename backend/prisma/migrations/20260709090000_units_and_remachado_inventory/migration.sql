CREATE TYPE "ProductSaleUnit" AS ENUM ('UNIDAD', 'METRO');
CREATE TYPE "SaleLineType" AS ENUM ('PRODUCTO', 'REMACHADO');
CREATE TYPE "RemachadoTrabajoTipo" AS ENUM ('JUEGO', 'MEDIO_JUEGO');
CREATE TYPE "RemachadoMovimientoTipo" AS ENUM ('INGRESO', 'AJUSTE', 'TRABAJO');

ALTER TABLE "Producto" ADD COLUMN "unidadVenta" "ProductSaleUnit" NOT NULL DEFAULT 'UNIDAD';
ALTER TABLE "Producto" ALTER COLUMN "stock" TYPE DOUBLE PRECISION USING "stock"::DOUBLE PRECISION;
ALTER TABLE "Producto" ALTER COLUMN "stockMinimo" TYPE DOUBLE PRECISION USING "stockMinimo"::DOUBLE PRECISION;

ALTER TABLE "ProductoStockSucursal" ALTER COLUMN "stock" TYPE DOUBLE PRECISION USING "stock"::DOUBLE PRECISION;
ALTER TABLE "ProductoEliminacionHistorial" ALTER COLUMN "stockAnterior" TYPE DOUBLE PRECISION USING "stockAnterior"::DOUBLE PRECISION;

ALTER TABLE "DetalleVenta" ADD COLUMN "tipoLinea" "SaleLineType" NOT NULL DEFAULT 'PRODUCTO';
ALTER TABLE "DetalleVenta" ADD COLUMN "descripcion" TEXT;
ALTER TABLE "DetalleVenta" ADD COLUMN "unidadVenta" TEXT;
ALTER TABLE "DetalleVenta" ADD COLUMN "remachadoTrabajoId" TEXT;
ALTER TABLE "DetalleVenta" ALTER COLUMN "cantidad" TYPE DOUBLE PRECISION USING "cantidad"::DOUBLE PRECISION;
ALTER TABLE "DetalleVenta" ALTER COLUMN "productoId" DROP NOT NULL;

ALTER TABLE "DetalleCompra" ALTER COLUMN "cantidad" TYPE DOUBLE PRECISION USING "cantidad"::DOUBLE PRECISION;

ALTER TABLE "MovimientoStock" ALTER COLUMN "stockAnterior" TYPE DOUBLE PRECISION USING "stockAnterior"::DOUBLE PRECISION;
ALTER TABLE "MovimientoStock" ALTER COLUMN "stockNuevo" TYPE DOUBLE PRECISION USING "stockNuevo"::DOUBLE PRECISION;
ALTER TABLE "MovimientoStock" ALTER COLUMN "cantidad" TYPE DOUBLE PRECISION USING "cantidad"::DOUBLE PRECISION;

ALTER TABLE "TransferenciaStock" ALTER COLUMN "cantidad" TYPE DOUBLE PRECISION USING "cantidad"::DOUBLE PRECISION;

CREATE TABLE "RemachadoMedida" (
  "id" TEXT NOT NULL,
  "medida" TEXT NOT NULL,
  "descripcion" TEXT,
  "stockJuegos" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stockMinimoJuegos" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "precioJuego" DOUBLE PRECISION NOT NULL,
  "precioMedioJuego" DOUBLE PRECISION NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RemachadoMedida_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RemachadoRemache" (
  "id" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "medida" TEXT,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "stockMinimo" INTEGER NOT NULL DEFAULT 20,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RemachadoRemache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RemachadoTrabajo" (
  "id" TEXT NOT NULL,
  "medidaId" TEXT NOT NULL,
  "remacheId" TEXT,
  "usuarioId" TEXT NOT NULL,
  "sucursalId" TEXT NOT NULL,
  "ventaId" TEXT,
  "tipoTrabajo" "RemachadoTrabajoTipo" NOT NULL,
  "cantidadJuegos" DOUBLE PRECISION NOT NULL,
  "cantidadBalatas" INTEGER NOT NULL,
  "cantidadRemaches" INTEGER NOT NULL,
  "precioUnitario" DOUBLE PRECISION NOT NULL,
  "total" DOUBLE PRECISION NOT NULL,
  "notas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RemachadoTrabajo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RemachadoMovimiento" (
  "id" TEXT NOT NULL,
  "tipo" "RemachadoMovimientoTipo" NOT NULL,
  "medidaId" TEXT,
  "remacheId" TEXT,
  "trabajoId" TEXT,
  "usuarioId" TEXT,
  "stockAnterior" DOUBLE PRECISION NOT NULL,
  "stockNuevo" DOUBLE PRECISION NOT NULL,
  "cantidad" DOUBLE PRECISION NOT NULL,
  "notas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RemachadoMovimiento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RemachadoMedida_medida_key" ON "RemachadoMedida"("medida");
CREATE UNIQUE INDEX "RemachadoRemache_codigo_key" ON "RemachadoRemache"("codigo");
CREATE INDEX "RemachadoTrabajo_medidaId_idx" ON "RemachadoTrabajo"("medidaId");
CREATE INDEX "RemachadoTrabajo_remacheId_idx" ON "RemachadoTrabajo"("remacheId");
CREATE INDEX "RemachadoTrabajo_ventaId_idx" ON "RemachadoTrabajo"("ventaId");
CREATE INDEX "RemachadoTrabajo_createdAt_idx" ON "RemachadoTrabajo"("createdAt");
CREATE INDEX "RemachadoMovimiento_medidaId_idx" ON "RemachadoMovimiento"("medidaId");
CREATE INDEX "RemachadoMovimiento_remacheId_idx" ON "RemachadoMovimiento"("remacheId");
CREATE INDEX "RemachadoMovimiento_trabajoId_idx" ON "RemachadoMovimiento"("trabajoId");
CREATE INDEX "RemachadoMovimiento_createdAt_idx" ON "RemachadoMovimiento"("createdAt");

ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_remachadoTrabajoId_fkey" FOREIGN KEY ("remachadoTrabajoId") REFERENCES "RemachadoTrabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RemachadoTrabajo" ADD CONSTRAINT "RemachadoTrabajo_medidaId_fkey" FOREIGN KEY ("medidaId") REFERENCES "RemachadoMedida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RemachadoTrabajo" ADD CONSTRAINT "RemachadoTrabajo_remacheId_fkey" FOREIGN KEY ("remacheId") REFERENCES "RemachadoRemache"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RemachadoTrabajo" ADD CONSTRAINT "RemachadoTrabajo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RemachadoTrabajo" ADD CONSTRAINT "RemachadoTrabajo_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RemachadoTrabajo" ADD CONSTRAINT "RemachadoTrabajo_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RemachadoMovimiento" ADD CONSTRAINT "RemachadoMovimiento_medidaId_fkey" FOREIGN KEY ("medidaId") REFERENCES "RemachadoMedida"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RemachadoMovimiento" ADD CONSTRAINT "RemachadoMovimiento_remacheId_fkey" FOREIGN KEY ("remacheId") REFERENCES "RemachadoRemache"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RemachadoMovimiento" ADD CONSTRAINT "RemachadoMovimiento_trabajoId_fkey" FOREIGN KEY ("trabajoId") REFERENCES "RemachadoTrabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RemachadoMovimiento" ADD CONSTRAINT "RemachadoMovimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
