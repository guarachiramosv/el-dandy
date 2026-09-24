-- CreateEnum
CREATE TYPE "SaleVoidRequestStatus" AS ENUM ('PENDIENTE', 'APROBADA');

-- CreateTable
CREATE TABLE "SolicitudAnulacionVenta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "administradorId" TEXT,
    "motivo" TEXT NOT NULL,
    "estado" "SaleVoidRequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudAnulacionVenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudAnulacionVenta_ventaId_key" ON "SolicitudAnulacionVenta"("ventaId");

-- CreateIndex
CREATE INDEX "SolicitudAnulacionVenta_estado_createdAt_idx" ON "SolicitudAnulacionVenta"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "SolicitudAnulacionVenta_solicitanteId_idx" ON "SolicitudAnulacionVenta"("solicitanteId");

-- CreateIndex
CREATE INDEX "SolicitudAnulacionVenta_administradorId_idx" ON "SolicitudAnulacionVenta"("administradorId");

-- AddForeignKey
ALTER TABLE "SolicitudAnulacionVenta" ADD CONSTRAINT "SolicitudAnulacionVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudAnulacionVenta" ADD CONSTRAINT "SolicitudAnulacionVenta_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudAnulacionVenta" ADD CONSTRAINT "SolicitudAnulacionVenta_administradorId_fkey" FOREIGN KEY ("administradorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
