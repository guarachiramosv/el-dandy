import { prisma } from './src/lib/prisma';
async function main() {
  const m = await prisma.remachadoMedida.findFirst({
    where: { medida: { contains: '191 XX TRASERA' } },
    include: {
      movimientos: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });
  console.dir(m, {depth: null});
}
main().catch(console.error).finally(() => prisma.$disconnect());
