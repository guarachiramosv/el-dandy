import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

type Operation = { storageKey: string; key: string };
const pending = new Map<string, Promise<Operation>>();

export async function prepareInventoryOperation(path: string, options: RequestInit, token?: string): Promise<Operation | null> {
  const method = (options.method || 'GET').toUpperCase();
  if (!token || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || !/^\/(products|sales|inventory|purchases|remachado)(\/|$)/.test(path) || (options.body && typeof options.body !== 'string')) return null;
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify({ method, path, body: options.body, token }));
  const storageKey = 'inventory-operation:' + digest;
  const existing = pending.get(storageKey);
  if (existing) return existing;
  const preparation = (async () => {
    let key: string | null = null;
    try { key = await AsyncStorage.getItem(storageKey); } catch { /* Memory fallback below. */ }
    if (!key) key = Crypto.randomUUID();
    try { await AsyncStorage.setItem(storageKey, key); } catch { /* Keep the in-memory key. */ }
    return { storageKey, key };
  })();
  pending.set(storageKey, preparation);
  return preparation;
}

export async function completeInventoryOperation(operation: Operation | null) {
  if (!operation) return;
  pending.delete(operation.storageKey);
  try { if (await AsyncStorage.getItem(operation.storageKey) === operation.key) await AsyncStorage.removeItem(operation.storageKey); } catch { /* Optional persistence. */ }
}
