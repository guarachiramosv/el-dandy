-- CreateTable
CREATE TABLE "ProductoImagen" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "productoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoImagen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductoImagen_productoId_idx" ON "ProductoImagen"("productoId");

-- AddForeignKey
ALTER TABLE "ProductoImagen" ADD CONSTRAINT "ProductoImagen_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing cover images into the gallery table.
INSERT INTO "ProductoImagen" ("id", "url", "orden", "productoId", "createdAt")
SELECT 'legacy-' || "id", "imagen", 0, "id", CURRENT_TIMESTAMP
FROM "Producto"
WHERE "imagen" IS NOT NULL AND "imagen" <> '';
