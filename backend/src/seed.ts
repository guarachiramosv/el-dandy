import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';
import { seedCredentials } from './lib/seed-policy';

const categories = ['Frenos', 'Motor', 'Filtros', 'Suspension', 'Aceites', 'Electrico'];
const sucursales = ['Cochabamba', 'Santa Cruz'];

async function main() {
  const credentials = seedCredentials();
  for (const nombre of sucursales) {
    const existing = await prisma.sucursal.findFirst({ where: { nombre } });
    if (!existing) await prisma.sucursal.create({ data: { nombre, whatsapp: '+59177956268' } });
    else if (!existing.whatsapp) await prisma.sucursal.update({ where: { id: existing.id }, data: { whatsapp: '+59177956268' } });
  }

  for (const nombre of categories) {
    const existing = await prisma.categoria.findFirst({ where: { nombre } });
    if (!existing) await prisma.categoria.create({ data: { nombre } });
  }

  const sucursal = await prisma.sucursal.findFirstOrThrow({ orderBy: { nombre: 'asc' } });
  const cochabamba = await prisma.sucursal.findFirstOrThrow({ where: { nombre: 'Cochabamba' } });
  const password = await bcrypt.hash(credentials.admin, 10);
  const sellerPassword = await bcrypt.hash(credentials.seller, 10);

  await prisma.usuario.upsert({
    where: { email: 'admin@eldandy.com' },
    update: {},
    create: {
      nombre: 'Admin Principal',
      email: 'admin@eldandy.com',
      password,
      role: 'ADMIN',
      sucursalId: sucursal.id,
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'vendedor@eldandy.com' },
    update: {},
    create: {
      nombre: 'Vendedor Cochabamba',
      email: 'vendedor@eldandy.com',
      password: sellerPassword,
      role: 'SELLER',
      activo: true,
      sucursalId: cochabamba.id,
    },
  });

  console.log('Usuarios de desarrollo preparados. Las cuentas existentes conservan sus permisos y contrasenas.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
