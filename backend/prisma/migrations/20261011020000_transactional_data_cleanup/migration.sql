UPDATE "CuentaCobrar"
SET "estado" = 'VENCIDA'
WHERE "saldo" > 0
  AND "fechaVencimiento" IS NOT NULL
  AND "fechaVencimiento" < CURRENT_TIMESTAMP
  AND "estado" IN ('PENDIENTE', 'PARCIAL');

UPDATE "AlertaStock" a
SET "leida" = true
FROM "Producto" p
WHERE a."productoId" = p."id"
  AND a."tipo" = 'STOCK_BAJO'
  AND a."leida" = false
  AND p."stock" > p."stockMinimo";

-- Un importe cero representa stock inicial sin desembolso, no un pago.
DELETE FROM "PagoCompra"
WHERE "monto" <= 0;

-- Reglas de integridad para que los importes y los estados no dependan
-- exclusivamente de la validacion de la API.
ALTER TABLE "Compra"
  DROP CONSTRAINT IF EXISTS "Compra_importes_validos_check",
  DROP CONSTRAINT IF EXISTS "Compra_estado_pago_coherente_check";

ALTER TABLE "Compra"
  ADD CONSTRAINT "Compra_importes_validos_check"
    CHECK (
      "subtotal" >= 0 AND "total" >= 0 AND "totalReales" >= 0
      AND "tipoCambio" >= 0 AND "montoPagado" >= 0
      AND "saldoPendiente" >= 0 AND "montoPagado" <= "total" + 0.01
      AND abs(("montoPagado" + "saldoPendiente") - "total") <= 0.01
    ),
  ADD CONSTRAINT "Compra_estado_pago_coherente_check"
    CHECK (
      ("estadoPago" = 'PENDIENTE' AND "montoPagado" <= 0.01 AND "saldoPendiente" > 0.01)
      OR ("estadoPago" = 'PARCIAL' AND "montoPagado" > 0.01 AND "saldoPendiente" > 0.01)
      OR ("estadoPago" = 'PAGADA' AND "saldoPendiente" <= 0.01)
    );

ALTER TABLE "PagoCompra"
  DROP CONSTRAINT IF EXISTS "PagoCompra_monto_positivo_check";
ALTER TABLE "PagoCompra"
  ADD CONSTRAINT "PagoCompra_monto_positivo_check" CHECK ("monto" > 0);

ALTER TABLE "Venta"
  DROP CONSTRAINT IF EXISTS "Venta_correccion_cierre_completa_check";
ALTER TABLE "Venta"
  ADD CONSTRAINT "Venta_correccion_cierre_completa_check"
    CHECK (
      NOT "esCorreccionCierre"
      OR (
        "cierreCorregidoId" IS NOT NULL
        AND "motivoCorreccion" IS NOT NULL
        AND length(btrim("motivoCorreccion")) >= 5
      )
    );

ALTER TABLE "CierreCaja"
  DROP CONSTRAINT IF EXISTS "CierreCaja_importes_version_validos_check",
  DROP CONSTRAINT IF EXISTS "CierreCaja_deposito_coherente_check";
ALTER TABLE "CierreCaja"
  ADD CONSTRAINT "CierreCaja_importes_version_validos_check"
    CHECK ("montoDeclarado" >= 0 AND "version" >= 1),
  ADD CONSTRAINT "CierreCaja_deposito_coherente_check"
    CHECK (
      (NOT "depositadoBanco" AND "montoDepositado" IS NULL)
      OR ("depositadoBanco" AND "montoDepositado" IS NOT NULL AND "montoDepositado" >= 0)
    );

ALTER TABLE "HistorialCierreCaja"
  DROP CONSTRAINT IF EXISTS "HistorialCierreCaja_version_valida_check";
ALTER TABLE "HistorialCierreCaja"
  ADD CONSTRAINT "HistorialCierreCaja_version_valida_check" CHECK ("version" >= 1);

ALTER TABLE "GastoCaja"
  DROP CONSTRAINT IF EXISTS "GastoCaja_monto_positivo_check";
ALTER TABLE "GastoCaja"
  ADD CONSTRAINT "GastoCaja_monto_positivo_check" CHECK ("monto" > 0);

ALTER TABLE "PagoCredito"
  DROP CONSTRAINT IF EXISTS "PagoCredito_monto_positivo_check";
ALTER TABLE "PagoCredito"
  ADD CONSTRAINT "PagoCredito_monto_positivo_check" CHECK ("monto" > 0);
