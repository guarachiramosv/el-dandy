WITH ranked_products AS (
  SELECT
    "id",
    "codigo",
    FIRST_VALUE("id") OVER (PARTITION BY lower(trim("codigo")) ORDER BY "createdAt" ASC, "id" ASC) AS "canonicalId",
    ROW_NUMBER() OVER (PARTITION BY lower(trim("codigo")) ORDER BY "createdAt" ASC, "id" ASC) AS "rank"
  FROM "Producto"
),
duplicate_products AS (
  SELECT "id", "canonicalId"
  FROM ranked_products
  WHERE "rank" > 1
),
duplicate_branch_stock AS (
  SELECT
    d."canonicalId" AS "productoId",
    ps."sucursalId",
    SUM(ps."stock")::integer AS "stock"
  FROM duplicate_products d
  JOIN "ProductoStockSucursal" ps ON ps."productoId" = d."id"
  GROUP BY d."canonicalId", ps."sucursalId"
)
INSERT INTO "ProductoStockSucursal" ("id", "productoId", "sucursalId", "stock", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text), "productoId", "sucursalId", "stock", CURRENT_TIMESTAMP
FROM duplicate_branch_stock
ON CONFLICT ("productoId", "sucursalId")
DO UPDATE SET "stock" = "ProductoStockSucursal"."stock" + EXCLUDED."stock";

WITH ranked_products AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (PARTITION BY lower(trim("codigo")) ORDER BY "createdAt" ASC, "id" ASC) AS "canonicalId",
    ROW_NUMBER() OVER (PARTITION BY lower(trim("codigo")) ORDER BY "createdAt" ASC, "id" ASC) AS "rank"
  FROM "Producto"
),
duplicate_products AS (
  SELECT "id"
  FROM ranked_products
  WHERE "rank" > 1
)
DELETE FROM "ProductoStockSucursal"
WHERE "productoId" IN (SELECT "id" FROM duplicate_products);

WITH canonical_products AS (
  SELECT DISTINCT
    FIRST_VALUE("id") OVER (PARTITION BY lower(trim("codigo")) ORDER BY "createdAt" ASC, "id" ASC) AS "id"
  FROM "Producto"
),
branch_totals AS (
  SELECT "productoId", SUM("stock")::integer AS "stock"
  FROM "ProductoStockSucursal"
  GROUP BY "productoId"
)
UPDATE "Producto" p
SET "stock" = COALESCE(bt."stock", 0)
FROM canonical_products cp
LEFT JOIN branch_totals bt ON bt."productoId" = cp."id"
WHERE p."id" = cp."id";

WITH ranked_products AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY lower(trim("codigo")) ORDER BY "createdAt" ASC, "id" ASC) AS "rank"
  FROM "Producto"
)
UPDATE "Producto" p
SET "stock" = 0,
    "activo" = false,
    "estado" = 'INACTIVO'
FROM ranked_products rp
WHERE p."id" = rp."id"
  AND rp."rank" > 1;
