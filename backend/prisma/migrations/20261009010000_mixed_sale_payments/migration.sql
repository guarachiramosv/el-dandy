ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MIXTO';

CREATE TABLE "PagoVenta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "metodoPago" "PaymentMethod" NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoVenta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PagoVenta_ventaId_metodoPago_key" ON "PagoVenta"("ventaId", "metodoPago");
CREATE INDEX "PagoVenta_metodoPago_createdAt_idx" ON "PagoVenta"("metodoPago", "createdAt");
CREATE INDEX "PagoVenta_ventaId_idx" ON "PagoVenta"("ventaId");

ALTER TABLE "PagoVenta"
ADD CONSTRAINT "PagoVenta_ventaId_fkey"
FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PagoVenta" ("id", "ventaId", "metodoPago", "monto", "createdAt")
SELECT gen_random_uuid()::text, "id", "metodoPago", "total", "createdAt"
FROM "Venta"
WHERE "tipoVenta" = 'CONTADO';
