import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Conexión a PostgreSQL (Neon) exitosa:", result);
  } catch (e) {
    console.error("❌ Error al conectar con la base de datos:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
