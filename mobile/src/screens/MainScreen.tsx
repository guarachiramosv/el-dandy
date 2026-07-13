import { useState } from 'react';
import {
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../components/BrandLogo';
import { clearSession } from '../session';
import { colors } from '../theme';
import { Session } from '../types';
import AdminProductsScreen from './AdminProductsScreen';
import AlertsScreen from './AlertsScreen';
import CustomersScreen from './CustomersScreen';
import InventoryScreen from './InventoryScreen';
import RemachadoScreen from './RemachadoScreen';
import SaleScreen from './SaleScreen';

type Tab = 'adminProducts' | 'stock' | 'sale' | 'remachado' | 'customers' | 'alerts';

type Props = {
  session: Session;
  onLogout: () => void;
};

export default function MainScreen({ session, onLogout }: Props) {
  const isAdmin = session.user.role === 'ADMIN';
  const [tab, setTab] = useState<Tab>(isAdmin ? 'adminProducts' : 'stock');
  const tabs: Array<{ id: Tab; icon: string; label: string }> = isAdmin
    ? [
        { id: 'adminProducts', icon: 'PR', label: 'Productos' },
        { id: 'remachado', icon: 'BA', label: 'Balatas' },
      ]
    : [
        { id: 'stock', icon: 'ST', label: 'Stock' },
        { id: 'sale', icon: 'VE', label: 'Venta' },
        { id: 'remachado', icon: 'BA', label: 'Balatas' },
        { id: 'customers', icon: 'CL', label: 'Clientes' },
        { id: 'alerts', icon: 'AL', label: 'Alertas' },
      ];

  const logout = () => {
    Alert.alert('Cerrar sesion', 'Quieres salir de la aplicacion?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await clearSession();
          onLogout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <View style={styles.brandBlock}>
          <BrandLogo compact />
          <View>
            <Text style={styles.brand}>Diesel Dandy</Text>
            <Text style={styles.user} numberOfLines={1}>
              {session.user.nombre} - {isAdmin ? 'Administrador' : 'Vendedor'}
            </Text>
          </View>
        </View>
        <Pressable onPress={logout} style={styles.logout}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {tab === 'adminProducts' && <AdminProductsScreen session={session} />}
        {tab === 'stock' && <InventoryScreen session={session} />}
        {tab === 'sale' && <SaleScreen session={session} />}
        {tab === 'remachado' && <RemachadoScreen session={session} />}
        {tab === 'customers' && <CustomersScreen session={session} />}
        {tab === 'alerts' && <AlertsScreen session={session} />}
      </View>

      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable key={item.id} onPress={() => setTab(item.id)} style={styles.tab}>
            <Text style={[styles.tabIcon, tab === item.id && styles.tabIconActive]}>{item.icon}</Text>
            <Text style={[styles.tabLabel, tab === item.id && styles.tabLabelActive]} numberOfLines={1}>
              {item.label}
            </Text>
            {tab === item.id && <View style={styles.activeLine} />}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  brandBlock: { alignItems: 'center', flexDirection: 'row', flex: 1, gap: 10, paddingRight: 12 },
  brand: { color: colors.text, fontSize: 18, fontWeight: '800' },
  user: { color: colors.muted, fontSize: 12, marginTop: 3, maxWidth: 250 },
  logout: { backgroundColor: colors.surfaceSoft, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  logoutText: { color: '#FCA5A5', fontSize: 12, fontWeight: '700' },
  content: { flex: 1 },
  tabs: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingBottom: 4,
    paddingTop: 6,
  },
  tab: { alignItems: 'center', flex: 1, minHeight: 54, position: 'relative' },
  tabIcon: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  tabIconActive: { color: colors.primaryLight },
  tabLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  tabLabelActive: { color: colors.primaryLight },
  activeLine: { backgroundColor: colors.primary, borderRadius: 4, bottom: 0, height: 3, position: 'absolute', width: 34 },
});
