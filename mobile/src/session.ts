import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomerSession, Session } from './types';

const SESSION_KEY = '@el-dandy/session';
const CUSTOMER_SESSION_KEY = '@el-dandy/customer-session';

export async function saveSession(session: Session) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession() {
  return AsyncStorage.removeItem(SESSION_KEY);
}

export async function saveCustomerSession(session: CustomerSession) {
  await AsyncStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
}

export async function loadCustomerSession(): Promise<CustomerSession | null> {
  const raw = await AsyncStorage.getItem(CUSTOMER_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomerSession;
  } catch {
    await AsyncStorage.removeItem(CUSTOMER_SESSION_KEY);
    return null;
  }
}

export function clearCustomerSession() {
  return AsyncStorage.removeItem(CUSTOMER_SESSION_KEY);
}
