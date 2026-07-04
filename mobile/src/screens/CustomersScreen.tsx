import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createCustomer, getCustomers } from '../api';
import { colors } from '../theme';
import { Customer, CustomerInput, Session } from '../types';

const emptyForm: CustomerInput = {
  nombre: '',
  telefono: '',
  email: '',
  empresa: '',
  ciudad: '',
  nit: '',
  direccion: '',
  notas: '',
};

export default function CustomersScreen({ session }: { session: Session }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CustomerInput>(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(async (term = search) => {
    setError('');
    try {
      setCustomers(await getCustomers(session.token, term));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, session.token]);

  useEffect(() => {
    load('');
  }, [session.token]);

  const setField = (field: keyof CustomerInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    if (form.nombre.trim().length < 2) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre del cliente.');
      return;
    }
    setSaving(true);
    try {
      const created = await createCustomer(session.token, {
        ...form,
        nombre: form.nombre.trim(),
      });
      setCustomers((current) => [created, ...current]);
      setForm(emptyForm);
      setModalOpen(false);
      Alert.alert('Cliente registrado', `${created.nombre} ya está guardado en la base de datos.`);
    } catch (err) {
      Alert.alert('No se pudo registrar', err instanceof Error ? err.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.heading}>Clientes</Text>
          <Text style={styles.caption}>Registro y consulta desde el celular.</Text>
        </View>
        <Pressable
          onPress={() => {
            setForm(emptyForm);
            setModalOpen(true);
          }}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+ Nuevo</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          onChangeText={setSearch}
          onSubmitEditing={() => {
            setLoading(true);
            load(search);
          }}
          placeholder="Nombre, teléfono, empresa o NIT"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={search}
        />
        <Pressable onPress={() => load(search)} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Buscar</Text>
        </Pressable>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={customers}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No hay clientes registrados.</Text>}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                setRefreshing(true);
                load(search);
              }}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.nombre.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{item.nombre}</Text>
                <Text style={styles.customerMeta}>
                  {item.empresa || 'Cliente particular'} · {item.telefono || 'Sin teléfono'}
                </Text>
                <Text style={styles.customerMeta}>
                  {item.ciudad || 'Sin ciudad'} · NIT {item.nit || '-'}
                </Text>
              </View>
              {(item.saldoPendiente || 0) > 0 && (
                <Text style={styles.debt}>Bs {item.saldoPendiente?.toFixed(2)}</Text>
              )}
            </View>
          )}
        />
      )}

      <Modal animationType="slide" onRequestClose={() => setModalOpen(false)} transparent visible={modalOpen}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo cliente</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.form}>
              <Field label="Nombre *" value={form.nombre} onChange={(value) => setField('nombre', value)} />
              <Field label="Teléfono" value={form.telefono || ''} onChange={(value) => setField('telefono', value)} keyboardType="phone-pad" />
              <Field label="Empresa" value={form.empresa || ''} onChange={(value) => setField('empresa', value)} />
              <Field label="NIT" value={form.nit || ''} onChange={(value) => setField('nit', value)} />
              <Field label="Ciudad" value={form.ciudad || ''} onChange={(value) => setField('ciudad', value)} />
              <Field label="Correo" value={form.email || ''} onChange={(value) => setField('email', value)} keyboardType="email-address" />
              <Field label="Dirección" value={form.direccion || ''} onChange={(value) => setField('direccion', value)} />
              <Field label="Notas" value={form.notas || ''} onChange={(value) => setField('notas', value)} />
              <Pressable disabled={saving} onPress={save} style={[styles.saveButton, saving && styles.disabled]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar cliente</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        keyboardType={keyboardType}
        onChangeText={onChange}
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  titleText: { flex: 1 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  caption: { color: colors.muted, marginTop: 4 },
  addButton: { backgroundColor: colors.primary, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11 },
  addButtonText: { color: '#fff', fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 15 },
  searchInput: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, flex: 1, paddingHorizontal: 13, paddingVertical: 12 },
  searchButton: { backgroundColor: colors.surfaceSoft, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 13 },
  searchButtonText: { color: colors.text, fontWeight: '700' },
  error: { color: '#FCA5A5', marginTop: 10 },
  loader: { marginTop: 50 },
  list: { gap: 9, paddingBottom: 24, paddingTop: 13 },
  empty: { color: colors.muted, marginTop: 40, textAlign: 'center' },
  card: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, flexDirection: 'row', padding: 13 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(249, 115, 22, 0.16)', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  avatarText: { color: '#BFDBFE', fontSize: 18, fontWeight: '900' },
  customerInfo: { flex: 1, paddingHorizontal: 11 },
  customerName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  customerMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  debt: { color: '#FCA5A5', fontWeight: '800' },
  modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.72)', flex: 1, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.background, borderColor: colors.border, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '92%' },
  modalHeader: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  close: { color: colors.muted, fontSize: 20 },
  form: { gap: 12, padding: 18, paddingBottom: 34 },
  label: { color: '#CBD5E1', fontSize: 13, marginBottom: 5 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 11, borderWidth: 1, color: colors.text, paddingHorizontal: 14, paddingVertical: 12 },
  saveButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, marginTop: 6, paddingVertical: 15 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
