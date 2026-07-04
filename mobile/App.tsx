import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import CustomerHomeScreen from './src/screens/CustomerHomeScreen';
import { loadCustomerSession, loadSession } from './src/session';
import { colors } from './src/theme';
import { CustomerSession, Session } from './src/types';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([loadSession(), loadCustomerSession()])
      .then(([savedSession, savedCustomerSession]) => {
        setSession(savedSession);
        setCustomerSession(savedSession ? null : savedCustomerSession);
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {session ? (
        <MainScreen session={session} onLogout={() => setSession(null)} />
      ) : customerSession ? (
        <CustomerHomeScreen session={customerSession} onLogout={() => setCustomerSession(null)} />
      ) : (
        <LoginScreen
          onLogin={(nextSession) => {
            setCustomerSession(null);
            setSession(nextSession);
          }}
          onCustomerLogin={setCustomerSession}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
