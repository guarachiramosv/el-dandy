import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { RemachadoService } from '../src/services/remachado.service';

test('historical remachado validates ownership and date before allowing correction', async () => {
  const original = prisma.$transaction;
  let query: any;
  let authorized = false;
  const stop = new Error('Authorized: reached inventory');
  const tx = {
    cierreCaja: {
      findFirst: async ({ where }: any) => { query = where; return authorized ? { id: 'closing' } : null; },
      findUnique: async () => ({ estado: 'OBSERVADO' }),
    },
    remachadoMedida: { findMany: async () => { throw stop; } },
  };
  (prisma as any).$transaction = async (fn: any) => fn(tx);
  const input = { usuarioId: 'seller', sucursalId: 'branch', metodoPago: 'EFECTIVO' as const,
    tipoVenta: 'CONTADO' as const, trabajos: [{ medidaId: 'measure', tipoTrabajo: 'JUEGO' as const }],
    fechaNegocio: '2026-11-04', cierreCorregidoId: 'closing', motivoCorreccion: 'Remachado omitido' };
  try {
    const service = new RemachadoService();
    await assert.rejects(service.createTrabajo({ ...input, motivoCorreccion: '' }), /explica la correccion/);
    await assert.rejects(service.createTrabajo(input), /no esta observado/);
    assert.deepEqual(query, { id: 'closing', usuarioId: 'seller', sucursalId: 'branch',
      fecha: new Date('2026-11-04T04:00:00Z'), estado: 'OBSERVADO' });
    authorized = true;
    (tx as any).remachadoRemache = { findMany: async () => [] };
    await assert.rejects(service.createTrabajo(input), error => error === stop);
  } finally { (prisma as any).$transaction = original; }
});
