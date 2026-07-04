CREATE TABLE "CierreCaja" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "cantidadVentas" INTEGER NOT NULL,
    "totalVentas" DOUBLE PRECISION NOT NULL,
    "totalEfectivo" DOUBLE PRECISION NOT NULL,
    "totalTransferencia" DOUBLE PRECISION NOT NULL,
    "totalQr" DOUBLE PRECISION NOT NULL,
    "totalTarjeta" DOUBLE PRECISION NOT NULL,
    "totalCredito" DOUBLE PRECISION NOT NULL,
    "montoDeclarado" DOUBLE PRECISION NOT NULL,
    "diferencia" DOUBLE PRECISION NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CierreCaja_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CierreCaja_fecha_usuarioId_sucursalId_key" ON "CierreCaja"("fecha", "usuarioId", "sucursalId");

ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
