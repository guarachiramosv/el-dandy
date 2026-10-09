CREATE TYPE "CategoriaMovimientoFinanciero" AS ENUM ('GASTO_NEGOCIO', 'RETIRO_PERSONAL', 'APORTE_PROPIETARIO');

CREATE TABLE "MovimientoFinanciero" (
    "id" TEXT NOT NULL,
    "categoria" "CategoriaMovimientoFinanciero" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "notas" TEXT,
    "usuarioId" TEXT NOT NULL,
    "sucursalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MovimientoFinanciero_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BalanceMensual" (
    "id" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "saldoInicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saldoReal" DOUBLE PRECISION,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BalanceMensual_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MovimientoFinanciero_fecha_idx" ON "MovimientoFinanciero"("fecha");
CREATE INDEX "MovimientoFinanciero_categoria_fecha_idx" ON "MovimientoFinanciero"("categoria", "fecha");
CREATE INDEX "MovimientoFinanciero_sucursalId_fecha_idx" ON "MovimientoFinanciero"("sucursalId", "fecha");
CREATE UNIQUE INDEX "BalanceMensual_mes_key" ON "BalanceMensual"("mes");

ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BalanceMensual" ADD CONSTRAINT "BalanceMensual_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
