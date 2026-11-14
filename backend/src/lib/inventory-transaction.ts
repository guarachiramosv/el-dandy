import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { inventoryRequest } from './inventory-request';

const conflict = () => Object.assign(new Error('El inventario cambio en otra operacion. Actualiza los datos antes de volver a intentar.'), { status: 409 });

// No automatic retries: a failed write must never turn into an unrequested second write.
export async function inventoryTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel } = {},
): Promise<T> {
  const request = inventoryRequest.getStore();
  const where = request ? { usuarioId_clave: { usuarioId: request.usuarioId, clave: request.clave } } : undefined;
  const readResult = (record: { hash: string; resultado: unknown }) => {
    if (record.hash !== request!.hash) {
      throw Object.assign(new Error('Este identificador ya se uso con otros datos. No se modifico el inventario.'), { status: 409 });
    }
    return record.resultado as T;
  };
  try {
    return await prisma.$transaction(async tx => {
      if (where) {
        const previous = await tx.operacionInventario.findUnique({ where });
        if (previous) return readResult(previous);
      }
      const result = await work(tx);
      if (request) {
        await tx.operacionInventario.create({ data: {
          ...request,
          resultado: result == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(result)),
        } });
      }
      return result;
    }, { maxWait: 10000, timeout: 20000, ...options, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error: any) {
    if (error.code === 'P2034' || error.code === 'P2002') {
      // A simultaneous identical request may have committed the result already.
      if (where) {
        const previous = await prisma.operacionInventario.findUnique({ where });
        if (previous) return readResult(previous);
      }
      if (error.code === 'P2034') throw conflict();
    }
    throw error;
  }
}
