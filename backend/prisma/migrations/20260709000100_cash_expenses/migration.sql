ALTER TABLE "CierreCaja"
ADD COLUMN "gastoEfectivo" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "gastoQr" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "totalGastos" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "netoEfectivo" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "netoQr" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "CierreCaja"
SET "netoEfectivo" = "totalEfectivo",
    "netoQr" = "totalQr"
WHERE "netoEfectivo" = 0
  AND "netoQr" = 0
  AND "totalGastos" = 0;

CREATE TABLE "GastoCaja" (
    "id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "metodoPago" "PaymentMethod" NOT NULL,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GastoCaja_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GastoCaja_usuarioId_sucursalId_createdAt_idx" ON "GastoCaja"("usuarioId", "sucursalId", "createdAt");
CREATE INDEX "GastoCaja_sucursalId_createdAt_idx" ON "GastoCaja"("sucursalId", "createdAt");

ALTER TABLE "GastoCaja" ADD CONSTRAINT "GastoCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GastoCaja" ADD CONSTRAINT "GastoCaja_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
