import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getAlerts } from '../api';
import { colors } from '../theme';
import { Session, StockAlert } from '../types';

export default function AlertsScreen({ session }: { session: Session }) {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setAlerts(await getAlerts(session.token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las alertas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Alertas de stock</Text>
      <Text style={styles.caption}>Productos agotados o por debajo del mínimo.</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={alerts}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successTitle}>Inventario saludable</Text>
              <Text style={styles.successText}>No hay alertas activas en este momento.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.tipo.replaceAll('_', ' ')}</Text>
              </View>
              <Text style={styles.product}>
                {item.producto?.codigo} · {item.producto?.descripcion}
              </Text>
              <Text style={styles.message}>{item.mensaje}</Text>
              <Text style={styles.meta}>
                {item.producto?.sucursal?.nombre || 'Sucursal'} · Stock {item.producto?.stock ?? 0}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  caption: { color: colors.muted, marginBottom: 12, marginTop: 4 },
  error: { color: '#FCA5A5', marginTop: 8 },
  loader: { marginTop: 50 },
  list: { gap: 10, paddingBottom: 24, paddingTop: 8 },
  card: {
    backgroundColor: '#20151A',
    borderColor: '#7F1D1D',
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
  },
  badge: { alignSelf: 'flex-start', backgroundColor: '#7F1D1D', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { color: '#FECACA', fontSize: 11, fontWeight: '800' },
  product: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 11 },
  message: { color: '#FCA5A5', marginTop: 5 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 10 },
  successCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, marginTop: 30, padding: 28 },
  successIcon: { color: colors.success, fontSize: 36, fontWeight: '900' },
  successTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 },
  successText: { color: colors.muted, marginTop: 5, textAlign: 'center' },
});
