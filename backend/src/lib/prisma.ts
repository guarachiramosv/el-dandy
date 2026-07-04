import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Global PrismaClient instance.
 *
 * In a serverless or hot‑reload development environment (e.g. `tsx watch`),
 * modules can be re‑executed on every request which would create a new
 * PrismaClient each time, eventually exhausting the database connections.
 *
 * This pattern attaches the client to the Node.js global object when not in
 * production, ensuring that subsequent imports reuse the same instance.
 */
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  // Attach to global to preserve across hot‑reloads
  global.prisma = prisma;
}
