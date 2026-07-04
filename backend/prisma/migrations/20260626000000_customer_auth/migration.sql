ALTER TABLE "Cliente" ADD COLUMN "password" TEXT;

CREATE UNIQUE INDEX "Cliente_email_key" ON "Cliente"("email");
