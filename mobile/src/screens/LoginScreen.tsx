import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { login, loginCustomer, registerCustomer } from '../api';
import {
  clearCustomerSession,
  loadCustomerSession,
  saveCustomerSession,
  saveSession,
} from '../session';
import { colors } from '../theme';
import { CustomerSession, Session } from '../types';
import BrandLogo from '../components/BrandLogo';

type Props = {
  onLogin: (session: Session) => void;
  onCustomerLogin: (session: CustomerSession) => void;
};

type AccessMode = 'STAFF' | 'CUSTOMER';
type CustomerMode = 'REGISTER' | 'LOGIN';

export default function LoginScreen({ onLogin, onCustomerLogin }: Props) {
  const [accessMode, setAccessMode] = useState<AccessMode>('STAFF');
  const [customerMode, setCustomerMode] = useState<CustomerMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerNit, setCustomerNit] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPassword, setCustomerPassword] = useState('');
  const [customerPasswordConfirm, setCustomerPasswordConfirm] = useState('');
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadCustomerSession().then(setCustomerSession);
  }, []);

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const submitStaff = async () => {
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contrasena.');
      return;
    }
    setLoading(true);
    resetMessages();
    try {
      const session = await login(email, password);
      await saveSession(session);
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesion.');
    } finally {
      setLoading(false);
    }
  };

  const submitCustomer = async () => {
    if (!customerEmail.trim() || !customerPassword) {
      setError('Ingresa tu correo y contrasena.');
      return;
    }
    if (customerMode === 'REGISTER') {
      if (!customerName.trim()) {
        setError('Ingresa tu nombre completo.');
        return;
      }
      if (customerPassword !== customerPasswordConfirm) {
        setError('Las contrasenas no coinciden.');
        return;
      }
    }

    setLoading(true);
    resetMessages();
    try {
      const session =
        customerMode === 'REGISTER'
          ? await registerCustomer({
              nombre: customerName,
              email: customerEmail,
              password: customerPassword,
              telefono: customerPhone || null,
              ciudad: customerCity || null,
              nit: customerNit || null,
              direccion: customerAddress || null,
            })
          : await loginCustomer(customerEmail, customerPassword);

      await saveCustomerSession(session);
      setCustomerSession(session);
      onCustomerLogin(session);
      setCustomerPassword('');
      setCustomerPasswordConfirm('');
      setSuccess(customerMode === 'REGISTER' ? 'Registro de cliente creado.' : 'Sesion de cliente iniciada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  const logoutCustomer = async () => {
    await clearCustomerSession();
    setCustomerSession(null);
    resetMessages();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <BrandLogo />
          <Text style={styles.subtitle}>Gestion movil y clientes</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.segment}>
            <Pressable
              onPress={() => {
                setAccessMode('STAFF');
                resetMessages();
              }}
              style={[styles.segmentButton, accessMode === 'STAFF' && styles.segmentButtonActive]}
            >
              <Text style={[styles.segmentText, accessMode === 'STAFF' && styles.segmentTextActive]}>Personal</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setAccessMode('CUSTOMER');
                setCustomerMode('LOGIN');
                resetMessages();
              }}
              style={[styles.segmentButton, accessMode === 'CUSTOMER' && styles.segmentButtonActive]}
            >
              <Text style={[styles.segmentText, accessMode === 'CUSTOMER' && styles.segmentTextActive]}>Cliente</Text>
            </Pressable>
          </View>

          {accessMode === 'STAFF' ? (
            <>
              <Text style={styles.cardTitle}>Iniciar sesion</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="Correo electronico"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                style={styles.input}
              />
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                placeholder="Contrasena"
                placeholderTextColor={colors.muted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submitStaff}
                style={styles.input}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Pressable disabled={loading} onPress={submitStaff} style={styles.button}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
              </Pressable>
            </>
          ) : customerSession ? (
            <>
              {!!success && <Text style={styles.success}>{success}</Text>}
              <View style={styles.customerBox}>
                <Text style={styles.customerLabel}>Cuenta de cliente activa</Text>
                <Text style={styles.customerName}>{customerSession.customer.nombre}</Text>
                <Text style={styles.customerEmail}>{customerSession.customer.email}</Text>
              </View>
              <Pressable onPress={logoutCustomer} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cerrar sesion de cliente</Text>
              </Pressable>
            </>
          ) : (
            <>
              {customerMode === 'REGISTER' && (
                <TextInput
                  placeholder="Nombre completo"
                  placeholderTextColor={colors.muted}
                  value={customerName}
                  onChangeText={setCustomerName}
                  style={styles.input}
                />
              )}
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="Correo electronico"
                placeholderTextColor={colors.muted}
                value={customerEmail}
                onChangeText={setCustomerEmail}
                style={styles.input}
              />
              {customerMode === 'REGISTER' && (
                <>
                  <TextInput
                    keyboardType="phone-pad"
                    placeholder="Telefono"
                    placeholderTextColor={colors.muted}
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                    style={styles.input}
                  />
                  <TextInput
                    placeholder="Ciudad"
                    placeholderTextColor={colors.muted}
                    value={customerCity}
                    onChangeText={setCustomerCity}
                    style={styles.input}
                  />
                  <TextInput
                    placeholder="NIT o CI"
                    placeholderTextColor={colors.muted}
                    value={customerNit}
                    onChangeText={setCustomerNit}
                    style={styles.input}
                  />
                  <TextInput
                    placeholder="Direccion"
                    placeholderTextColor={colors.muted}
                    value={customerAddress}
                    onChangeText={setCustomerAddress}
                    style={styles.input}
                  />
                </>
              )}
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                placeholder="Contrasena"
                placeholderTextColor={colors.muted}
                secureTextEntry
                value={customerPassword}
                onChangeText={setCustomerPassword}
                style={styles.input}
              />
              {customerMode === 'REGISTER' && (
                <TextInput
                  autoCapitalize="none"
                  autoComplete="password"
                  placeholder="Confirmar contrasena"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  value={customerPasswordConfirm}
                  onChangeText={setCustomerPasswordConfirm}
                  onSubmitEditing={submitCustomer}
                  style={styles.input}
                />
              )}
              {!!error && <Text style={styles.error}>{error}</Text>}
              {!!success && <Text style={styles.success}>{success}</Text>}
              <Pressable disabled={loading} onPress={submitCustomer} style={styles.button}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {customerMode === 'REGISTER' ? 'Crear cuenta de cliente' : 'Entrar como cliente'}
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => {
                  setCustomerMode(customerMode === 'REGISTER' ? 'LOGIN' : 'REGISTER');
                  resetMessages();
                }}
                style={styles.linkButton}
              >
                <Text style={styles.linkButtonText}>
                  {customerMode === 'REGISTER' ? 'Ya tengo cuenta' : 'Crear cuenta'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 30 },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 10 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
  },
  cardTitle: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 18 },
  segment: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 4,
  },
  segmentButton: { alignItems: 'center', borderRadius: 10, flex: 1, paddingVertical: 11 },
  segmentButtonActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  error: { color: '#FCA5A5', marginBottom: 12 },
  success: { color: '#86EFAC', marginBottom: 12 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 4,
    paddingVertical: 15,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkButton: { alignItems: 'center', paddingTop: 14 },
  linkButtonText: { color: colors.primaryLight, fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 15,
  },
  secondaryButtonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  customerBox: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  customerLabel: { color: colors.muted, fontSize: 13 },
  customerName: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 4 },
  customerEmail: { color: colors.muted, fontSize: 14, marginTop: 4 },
});
