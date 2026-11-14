type OperationStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type InventoryOperation = { storageKey: string; key: string };
const fallback = new Map<string, string>();

export async function prepareInventoryOperation(method: string, path: string, body: unknown, actor: string, storage: OperationStorage): Promise<InventoryOperation | null> {
  if (!/^(post|put|patch|delete)$/i.test(method) || !/^\/(products|sales|inventory|purchases|remachado)(\/|$)/.test(path) || body instanceof FormData) return null;
  const input = JSON.stringify({ method: method.toUpperCase(), path, body, actor });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const storageKey = 'inventory-operation:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  let key = fallback.get(storageKey);
  try { key = storage.getItem(storageKey) || key; } catch { /* Private browsing can disable storage. */ }
  if (!key) key = crypto.randomUUID();
  fallback.set(storageKey, key);
  try { storage.setItem(storageKey, key); } catch { /* In-memory replay protection remains available. */ }
  return { storageKey, key };
}

export function completeInventoryOperation(operation: InventoryOperation | null | undefined, storage: OperationStorage) {
  if (!operation) return;
  fallback.delete(operation.storageKey);
  try { if (storage.getItem(operation.storageKey) === operation.key) storage.removeItem(operation.storageKey); } catch { /* Optional persistent storage. */ }
}
