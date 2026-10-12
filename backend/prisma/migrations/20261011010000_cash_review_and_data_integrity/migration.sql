CREATE TYPE "CashClosingStatus" AS ENUM ('PENDIENTE', 'OBSERVADO', 'APROBADO');
CREATE TYPE "CashClosingAction" AS ENUM ('ENVIADO', 'OBSERVADO', 'REENVIADO', 'APROBADO');
CREATE TYPE "PurchasePaymentStatus" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA');
CREATE TYPE "PurchaseOrigin" AS ENUM ('COMPRA_DIRECTA', 'COMPRA_INICIAL_PRODUCTO', 'AGREGAR_STOCK', 'MIGRACION_HISTORICA');

ALTER TABLE "Venta"
ADD COLUMN "fechaNegocio" TIMESTAMP(3),
ADD COLUMN "esCorreccionCierre" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "motivoCorreccion" TEXT,
ADD COLUMN "cierreCorregidoId" TEXT;

UPDATE "Venta"
SET "fechaNegocio" = date_trunc('day', "createdAt" - INTERVAL '4 hours') + INTERVAL '4 hours';

ALTER TABLE "Venta" ALTER COLUMN "fechaNegocio" SET NOT NULL;
ALTER TABLE "Venta" ALTER COLUMN "fechaNegocio" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "GastoCaja" ADD COLUMN "fechaNegocio" TIMESTAMP(3);
UPDATE "GastoCaja"
SET "fechaNegocio" = date_trunc('day', "createdAt" - INTERVAL '4 hours') + INTERVAL '4 hours';
ALTER TABLE "GastoCaja" ALTER COLUMN "fechaNegocio" SET NOT NULL;
ALTER TABLE "GastoCaja" ALTER COLUMN "fechaNegocio" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PagoCredito" ADD COLUMN "fechaNegocio" TIMESTAMP(3);
UPDATE "PagoCredito"
SET "fechaNegocio" = date_trunc('day', "createdAt" - INTERVAL '4 hours') + INTERVAL '4 hours';
ALTER TABLE "PagoCredito" ALTER COLUMN "fechaNegocio" SET NOT NULL;
ALTER TABLE "PagoCredito" ALTER COLUMN "fechaNegocio" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CierreCaja"
ADD COLUMN "estado" "CashClosingStatus" NOT NULL DEFAULT 'APROBADO',
ADD COLUMN "administradorId" TEXT,
ADD COLUMN "motivoObservacion" TEXT,
ADD COLUMN "notaAdministrador" TEXT,
ADD COLUMN "depositadoBanco" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "montoDepositado" DOUBLE PRECISION,
ADD COLUMN "fechaDeposito" TIMESTAMP(3),
ADD COLUMN "referenciaDeposito" TEXT,
ADD COLUMN "enviadoAt" TIMESTAMP(3),
ADD COLUMN "revisadoAt" TIMESTAMP(3),
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "CierreCaja"
SET "enviadoAt" = "createdAt",
    "revisadoAt" = "createdAt",
    "montoDepositado" = "montoDeclarado",
    "fechaDeposito" = "createdAt",
    "updatedAt" = "createdAt";

ALTER TABLE "CierreCaja" ALTER COLUMN "enviadoAt" SET NOT NULL;
ALTER TABLE "CierreCaja" ALTER COLUMN "enviadoAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CierreCaja" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
ALTER TABLE "CierreCaja" ALTER COLUMN "depositadoBanco" SET DEFAULT false;

CREATE TABLE "HistorialCierreCaja" (
  "id" TEXT NOT NULL,
  "cierreId" TEXT NOT NULL,
  "accion" "CashClosingAction" NOT NULL,
  "actorId" TEXT NOT NULL,
  "comentario" TEXT,
  "montoDeclarado" DOUBLE PRECISION NOT NULL,
  "efectivoEsperado" DOUBLE PRECISION NOT NULL,
  "diferencia" DOUBLE PRECISION NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistorialCierreCaja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PagoCompra" (
  "id" TEXT NOT NULL,
  "compraId" TEXT NOT NULL,
  "monto" DOUBLE PRECISION NOT NULL,
  "metodoPago" "PaymentMethod",
  "usuarioId" TEXT NOT NULL,
  "notas" TEXT,
  "fechaNegocio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PagoCompra_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Compra"
ADD COLUMN "totalReales" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "tipoCambio" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "estadoPago" "PurchasePaymentStatus" NOT NULL DEFAULT 'PAGADA',
ADD COLUMN "montoPagado" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "saldoPendiente" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "metodoPago" "PaymentMethod",
ADD COLUMN "fechaVencimiento" TIMESTAMP(3),
ADD COLUMN "comprobante" TEXT,
ADD COLUMN "origen" "PurchaseOrigin" NOT NULL DEFAULT 'COMPRA_DIRECTA',
ADD COLUMN "fechaNegocio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Compra"
SET "montoPagado" = "total",
    "fechaNegocio" = date_trunc('day', "createdAt" - INTERVAL '4 hours') + INTERVAL '4 hours';

INSERT INTO "Compra" (
  "id", "proveedorId", "sucursalId", "usuarioId", "subtotal", "total",
  "totalReales", "tipoCambio", "estado", "estadoPago", "montoPagado",
  "saldoPendiente", "comprobante", "origen", "fechaNegocio", "notas", "createdAt"
)
SELECT
  'legacy-purchase-' || m."id",
  m."proveedorId",
  m."sucursalId",
  m."usuarioId",
  COALESCE(m."costoTotal", 0),
  COALESCE(m."costoTotal", 0),
  COALESCE(m."costoTotalReales", 0),
  COALESCE(m."tipoCambio", 0),
  'RECIBIDA'::"PurchaseStatus",
  'PAGADA'::"PurchasePaymentStatus",
  COALESCE(m."costoTotal", 0),
  0,
  m."comprobante",
  CASE m."referenciaTipo"
    WHEN 'COMPRA_INICIAL_PRODUCTO' THEN 'COMPRA_INICIAL_PRODUCTO'::"PurchaseOrigin"
    WHEN 'AGREGAR_STOCK' THEN 'AGREGAR_STOCK'::"PurchaseOrigin"
    ELSE 'MIGRACION_HISTORICA'::"PurchaseOrigin"
  END,
  date_trunc('day', m."createdAt" - INTERVAL '4 hours') + INTERVAL '4 hours',
  m."notas",
  m."createdAt"
FROM "MovimientoStock" m
WHERE m."tipoMovimiento" = 'COMPRA'
  AND m."proveedorId" IS NOT NULL
  AND m."usuarioId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Compra" c WHERE c."id" = 'legacy-purchase-' || m."id");

INSERT INTO "DetalleCompra" (
  "id", "compraId", "productoId", "cantidad", "precioUnitario", "subtotal", "createdAt"
)
SELECT
  'legacy-purchase-detail-' || m."id",
  'legacy-purchase-' || m."id",
  m."productoId",
  m."cantidad",
  COALESCE(m."precioCompraUnitario", 0),
  COALESCE(m."costoTotal", 0),
  m."createdAt"
FROM "MovimientoStock" m
WHERE m."tipoMovimiento" = 'COMPRA'
  AND m."proveedorId" IS NOT NULL
  AND m."usuarioId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Compra" c WHERE c."id" = 'legacy-purchase-' || m."id")
  AND NOT EXISTS (SELECT 1 FROM "DetalleCompra" d WHERE d."id" = 'legacy-purchase-detail-' || m."id");

INSERT INTO "PagoCompra" (
  "id", "compraId", "monto", "metodoPago", "usuarioId", "notas", "fechaNegocio", "createdAt"
)
SELECT
  'legacy-purchase-payment-' || m."id",
  'legacy-purchase-' || m."id",
  COALESCE(m."costoTotal", 0),
  NULL,
  m."usuarioId",
  'Pago historico migrado desde movimiento de inventario',
  date_trunc('day', m."createdAt" - INTERVAL '4 hours') + INTERVAL '4 hours',
  m."createdAt"
FROM "MovimientoStock" m
WHERE m."tipoMovimiento" = 'COMPRA'
  AND m."proveedorId" IS NOT NULL
  AND m."usuarioId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Compra" c WHERE c."id" = 'legacy-purchase-' || m."id")
  AND NOT EXISTS (SELECT 1 FROM "PagoCompra" p WHERE p."id" = 'legacy-purchase-payment-' || m."id");

UPDATE "MovimientoStock"
SET "referenciaId" = 'legacy-purchase-' || "id",
    "referenciaTipo" = 'COMPRA'
WHERE "tipoMovimiento" = 'COMPRA'
  AND "proveedorId" IS NOT NULL
  AND "usuarioId" IS NOT NULL;

ALTER TABLE "Compra" ADD CONSTRAINT "Compra_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PagoCredito" ADD CONSTRAINT "PagoCredito_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransferenciaStock" ADD CONSTRAINT "TransferenciaStock_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransferenciaStock" ADD CONSTRAINT "TransferenciaStock_sucursalOrigenId_fkey"
FOREIGN KEY ("sucursalOrigenId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransferenciaStock" ADD CONSTRAINT "TransferenciaStock_sucursalDestinoId_fkey"
FOREIGN KEY ("sucursalDestinoId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_administradorId_fkey"
FOREIGN KEY ("administradorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_cierreCorregidoId_fkey"
FOREIGN KEY ("cierreCorregidoId") REFERENCES "CierreCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HistorialCierreCaja" ADD CONSTRAINT "HistorialCierreCaja_cierreId_fkey"
FOREIGN KEY ("cierreId") REFERENCES "CierreCaja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HistorialCierreCaja" ADD CONSTRAINT "HistorialCierreCaja_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PagoCompra" ADD CONSTRAINT "PagoCompra_compraId_fkey"
FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PagoCompra" ADD CONSTRAINT "PagoCompra_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Venta_fechaNegocio_idx" ON "Venta"("fechaNegocio");
CREATE INDEX "Venta_usuarioId_sucursalId_fechaNegocio_idx" ON "Venta"("usuarioId", "sucursalId", "fechaNegocio");
CREATE INDEX "Venta_cierreCorregidoId_idx" ON "Venta"("cierreCorregidoId");
CREATE INDEX "GastoCaja_usuarioId_sucursalId_fechaNegocio_idx" ON "GastoCaja"("usuarioId", "sucursalId", "fechaNegocio");
CREATE INDEX "PagoCredito_usuarioId_fechaNegocio_idx" ON "PagoCredito"("usuarioId", "fechaNegocio");
CREATE INDEX "CierreCaja_estado_createdAt_idx" ON "CierreCaja"("estado", "createdAt");
CREATE INDEX "CierreCaja_administradorId_idx" ON "CierreCaja"("administradorId");
CREATE INDEX "HistorialCierreCaja_cierreId_createdAt_idx" ON "HistorialCierreCaja"("cierreId", "createdAt");
CREATE INDEX "HistorialCierreCaja_actorId_idx" ON "HistorialCierreCaja"("actorId");
CREATE INDEX "Compra_fechaNegocio_idx" ON "Compra"("fechaNegocio");
CREATE INDEX "Compra_usuarioId_idx" ON "Compra"("usuarioId");
CREATE INDEX "Compra_estadoPago_fechaVencimiento_idx" ON "Compra"("estadoPago", "fechaVencimiento");
CREATE INDEX "PagoCompra_compraId_createdAt_idx" ON "PagoCompra"("compraId", "createdAt");
CREATE INDEX "PagoCompra_usuarioId_fechaNegocio_idx" ON "PagoCompra"("usuarioId", "fechaNegocio");
