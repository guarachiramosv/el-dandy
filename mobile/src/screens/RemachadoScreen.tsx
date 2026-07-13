import { useEffect, useMemo, useState } from 'react';
import * as Print from 'expo-print';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createRemachadoMedida, createRemachadoTrabajo, getProducts, getRemachadoSummary } from '../api';
import { colors } from '../theme';
import { buildThermalReceiptHtml } from '../thermalReceipt';
import type { PaymentMethod, Product, RemachadoMedida, RemachadoRemache, RemachadoTrabajo, Session } from '../types';

type DetailItem = { id: string; product: Product; quantity: number; price: number };

const paymentMethods: PaymentMethod[] = ['EFECTIVO', 'TRANSFERENCIA', 'QR', 'TARJETA'];
const money = (value: number) => `Bs ${value.toFixed(2)}`;
const toNumber = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function RemachadoScreen({ session }: { session: Session }) {
  const isAdmin = session.user.role === 'ADMIN';
  const [medidas, setMedidas] = useState<RemachadoMedida[]>([]);
  const [remaches, setRemaches] = useState<RemachadoRemache[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [medidaId, setMedidaId] = useState('');
  const [remacheId, setRemacheId] = useState('');
  const [tipoTrabajo, setTipoTrabajo] = useState<'JUEGO' | 'MEDIO_JUEGO'>('JUEGO');
  const [payment, setPayment] = useState<PaymentMethod>('EFECTIVO');
  const [notes, setNotes] = useState('');

  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [detailQuantity, setDetailQuantity] = useState('1');
  const [detailPrice, setDetailPrice] = useState('0');
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);

  const [measureForm, setMeasureForm] = useState({
    medida: '',
    descripcion: '',
    stockJuegos: '0',
    stockMinimoJuegos: '1',
    precioJuego: '0',
    precioMedioJuego: '0',
    remachesPorJuego: '8',
    remachesPorMedioJuego: '4',
  });

  const load = async () => {
    setError('');
    try {
      const [summary, inventory] = await Promise.all([getRemachadoSummary(session.token), getProducts(session.token)]);
      const activeMedidas = summary.medidas.filter((item) => item.activo);
      const activeRemaches = summary.remaches.filter((item) => item.activo);
      setMedidas(activeMedidas);
      setRemaches(activeRemaches);
      setProducts(inventory.filter((product) => product.stock > 0 && product.unidadVenta !== 'METRO'));
      setMedidaId((current) => current || activeMedidas[0]?.id || '');
      setRemacheId((current) => current || activeRemaches[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar remachado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [session.token]);

  const selectedMedida = medidas.find((item) => item.id === medidaId);
  const selectedProduct = products.find((item) => item.id === selectedProductId);
  const selectedPrice = selectedMedida
    ? tipoTrabajo === 'MEDIO_JUEGO' ? selectedMedida.precioMedioJuego : selectedMedida.precioJuego
    : 0;
  const selectedBalatas = tipoTrabajo === 'MEDIO_JUEGO' ? 2 : 4;
  const internalRemaches = selectedMedida
    ? tipoTrabajo === 'MEDIO_JUEGO' ? selectedMedida.remachesPorMedioJuego : selectedMedida.remachesPorJuego
    : 0;
  const detailSubtotal = detailItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const total = selectedPrice + detailSubtotal;
  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = term
      ? products.filter((product) => `${product.codigo} ${product.descripcion} ${product.marca || ''}`.toLowerCase().includes(term))
      : products;
    return source.slice(0, 10);
  }, [products, search]);

  const submitMeasure = async () => {
    if (!measureForm.medida.trim()) return Alert.alert('Medida requerida', 'Escribe la medida de balata.');
    setSaving(true);
    try {
      await createRemachadoMedida(session.token, {
        medida: measureForm.medida,
        descripcion: measureForm.descripcion || null,
        stockJuegos: toNumber(measureForm.stockJuegos),
        stockMinimoJuegos: toNumber(measureForm.stockMinimoJuegos),
        precioJuego: toNumber(measureForm.precioJuego),
        precioMedioJuego: toNumber(measureForm.precioMedioJuego),
        remachesPorJuego: toNumber(measureForm.remachesPorJuego),
        remachesPorMedioJuego: toNumber(measureForm.remachesPorMedioJuego),
      });
      setMeasureForm({
        medida: '',
        descripcion: '',
        stockJuegos: '0',
        stockMinimoJuegos: '1',
        precioJuego: '0',
        precioMedioJuego: '0',
        remachesPorJuego: '8',
        remachesPorMedioJuego: '4',
      });
      await load();
      Alert.alert('Medida creada', 'Ya esta disponible para remachado.');
    } catch (err) {
      Alert.alert('No se pudo crear', err instanceof Error ? err.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const addProduct = () => {
    if (!selectedProduct) return Alert.alert('Producto requerido', 'Selecciona un producto.');
    const quantity = toNumber(detailQuantity);
    const price = toNumber(detailPrice);
    if (quantity <= 0) return Alert.alert('Cantidad invalida', 'La cantidad debe ser mayor a cero.');
    if (quantity > selectedProduct.stock) return Alert.alert('Stock insuficiente', `Disponible: ${selectedProduct.stock}`);
    setDetailItems((current) => [...current, { id: `${selectedProduct.id}-${Date.now()}`, product: selectedProduct, quantity, price }]);
    setSelectedProductId('');
    setDetailQuantity('1');
    setDetailPrice('0');
  };

  const printTrabajo = async (trabajo: RemachadoTrabajo) => {
    if (!trabajo.venta) return;
    try {
      await Print.printAsync({ html: buildThermalReceiptHtml(trabajo.venta, session.user.nombre), width: 227 });
    } catch (err) {
      Alert.alert('No se pudo imprimir', err instanceof Error ? err.message : 'Revisa la impresora.');
    }
  };

  const submitTrabajo = async () => {
    if (!medidaId) return Alert.alert('Medida requerida', 'Selecciona una medida de balata.');
    setSaving(true);
    try {
      const trabajo = await createRemachadoTrabajo(session, {
        medidaId,
        remacheId: remacheId || null,
        metodoPago: payment,
        tipoTrabajo,
        accesorios: detailItems.map((item) => ({ productoId: item.product.id, cantidad: item.quantity, precioUnitario: item.price })),
        notas: notes || null,
      });
      setDetailItems([]);
      setNotes('');
      await load();
      Alert.alert('Remachado registrado', `Total: ${money(trabajo.total)}`, [
        { text: 'Cerrar', style: 'cancel' },
        { text: 'Imprimir', onPress: () => void printTrabajo(trabajo) },
      ]);
    } catch (err) {
      Alert.alert('No se pudo registrar', err instanceof Error ? err.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Remachado</Text>
      <Text style={styles.caption}>Balatas por medida, productos extra e impresion.</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {isAdmin && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Crear medida</Text>
          <Field label="Medida" value={measureForm.medida} onChangeText={(value) => setMeasureForm((current) => ({ ...current, medida: value }))} />
          <Field label="Descripcion" value={measureForm.descripcion} onChangeText={(value) => setMeasureForm((current) => ({ ...current, descripcion: value }))} />
          <View style={styles.grid}>
            <Field label="Stock juegos" numeric value={measureForm.stockJuegos} onChangeText={(value) => setMeasureForm((current) => ({ ...current, stockJuegos: value }))} />
            <Field label="Stock minimo" numeric value={measureForm.stockMinimoJuegos} onChangeText={(value) => setMeasureForm((current) => ({ ...current, stockMinimoJuegos: value }))} />
          </View>
          <View style={styles.grid}>
            <Field label="Precio juego" numeric value={measureForm.precioJuego} onChangeText={(value) => setMeasureForm((current) => ({ ...current, precioJuego: value }))} />
            <Field label="Precio 1/2" numeric value={measureForm.precioMedioJuego} onChangeText={(value) => setMeasureForm((current) => ({ ...current, precioMedioJuego: value }))} />
          </View>
          <View style={styles.grid}>
            <Field label="Remaches juego" numeric value={measureForm.remachesPorJuego} onChangeText={(value) => setMeasureForm((current) => ({ ...current, remachesPorJuego: value }))} />
            <Field label="Remaches 1/2" numeric value={measureForm.remachesPorMedioJuego} onChangeText={(value) => setMeasureForm((current) => ({ ...current, remachesPorMedioJuego: value }))} />
          </View>
          <Pressable disabled={saving} onPress={submitMeasure} style={[styles.primaryButton, saving && styles.disabled]}>
            <Text style={styles.primaryText}>Crear medida</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Trabajo</Text>
        <Text style={styles.label}>Medida</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {medidas.map((item) => (
            <Pressable key={item.id} onPress={() => setMedidaId(item.id)} style={[styles.chip, medidaId === item.id && styles.chipActive]}>
              <Text style={[styles.chipText, medidaId === item.id && styles.chipTextActive]}>{item.medida}</Text>
              <Text style={styles.chipSub}>Stock {item.stockJuegos}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.grid}>
          <Choice label="1 juego" active={tipoTrabajo === 'JUEGO'} onPress={() => setTipoTrabajo('JUEGO')} />
          <Choice label="1/2 juego" active={tipoTrabajo === 'MEDIO_JUEGO'} onPress={() => setTipoTrabajo('MEDIO_JUEGO')} />
        </View>
        <Text style={styles.label}>Remache a descontar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable onPress={() => setRemacheId('')} style={[styles.chip, !remacheId && styles.chipActive]}>
            <Text style={[styles.chipText, !remacheId && styles.chipTextActive]}>Sin remache</Text>
            <Text style={styles.chipSub}>No descuenta</Text>
          </Pressable>
          {remaches.map((item) => (
            <Pressable key={item.id} onPress={() => setRemacheId(item.id)} style={[styles.chip, remacheId === item.id && styles.chipActive]}>
              <Text style={[styles.chipText, remacheId === item.id && styles.chipTextActive]}>{item.codigo}</Text>
              <Text style={styles.chipSub}>Stock {item.stock}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.summary}>
          <Text style={styles.summaryText}>{selectedBalatas} balatas</Text>
          <Text style={styles.summaryMuted}>Remaches internos: {internalRemaches}</Text>
          <Text style={styles.summaryTotal}>{money(selectedPrice)}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Detalle de venta</Text>
        <Text style={styles.captionSmall}>Agrega solo los productos que tambien lleva el cliente.</Text>
        <Field label="Buscar producto" value={search} onChangeText={setSearch} />
        {visibleProducts.map((product) => (
          <Pressable
            key={product.id}
            onPress={() => {
              setSelectedProductId(product.id);
              setDetailPrice(String(product.precioVenta || 0));
            }}
            style={[styles.productRow, selectedProductId === product.id && styles.productRowActive]}
          >
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{product.descripcion}</Text>
              <Text style={styles.productMeta}>{product.codigo} - Stock {product.stock}</Text>
            </View>
            <Text style={styles.productPrice}>{money(product.precioVenta)}</Text>
          </Pressable>
        ))}
        <View style={styles.grid}>
          <Field label="Cantidad" numeric value={detailQuantity} onChangeText={setDetailQuantity} />
          <Field label="Precio" numeric value={detailPrice} onChangeText={setDetailPrice} />
        </View>
        <Pressable onPress={addProduct} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Agregar producto</Text>
        </Pressable>
        {detailItems.map((item) => (
          <View key={item.id} style={styles.detailRow}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.product.descripcion}</Text>
              <Text style={styles.productMeta}>{item.quantity} x {money(item.price)}</Text>
            </View>
            <Pressable onPress={() => setDetailItems((current) => current.filter((entry) => entry.id !== item.id))}>
              <Text style={styles.removeText}>Quitar</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Pago</Text>
        <View style={styles.paymentGrid}>
          {paymentMethods.map((method) => (
            <Choice key={method} label={method} active={payment === method} onPress={() => setPayment(method)} />
          ))}
        </View>
        <Field label="Notas" value={notes} onChangeText={setNotes} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>{money(total)}</Text>
        </View>
        <Pressable disabled={saving || !medidaId} onPress={submitTrabajo} style={[styles.primaryButton, (saving || !medidaId) && styles.disabled]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Registrar e imprimir</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, numeric = false }: { label: string; value: string; onChangeText: (value: string) => void; numeric?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput keyboardType={numeric ? 'numeric' : 'default'} onChangeText={onChangeText} style={styles.input} value={value} />
    </View>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 34 },
  loader: { marginTop: 60 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  caption: { color: colors.muted, marginBottom: 14, marginTop: 4 },
  captionSmall: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  error: { color: '#FCA5A5', marginBottom: 10 },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, marginBottom: 14, padding: 14 },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  field: { flex: 1, marginBottom: 10 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 4 },
  input: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: 11, borderWidth: 1, color: colors.text, paddingHorizontal: 12, paddingVertical: 11 },
  grid: { flexDirection: 'row', gap: 10 },
  chips: { gap: 8, paddingBottom: 8 },
  chip: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: 12, borderWidth: 1, minWidth: 112, paddingHorizontal: 12, paddingVertical: 10 },
  chipActive: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '800' },
  chipTextActive: { color: colors.primaryLight },
  chipSub: { color: colors.muted, fontSize: 11, marginTop: 4 },
  choice: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: 11, borderWidth: 1, flex: 1, paddingHorizontal: 10, paddingVertical: 11 },
  choiceActive: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderColor: colors.primary },
  choiceText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  choiceTextActive: { color: colors.primaryLight },
  summary: { borderColor: colors.border, borderRadius: 13, borderWidth: 1, marginTop: 6, padding: 12 },
  summaryText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  summaryMuted: { color: colors.muted, fontSize: 12, marginTop: 3 },
  summaryTotal: { color: colors.primaryLight, fontSize: 24, fontWeight: '900', marginTop: 8 },
  productRow: { alignItems: 'center', borderColor: colors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', marginBottom: 8, padding: 11 },
  productRowActive: { borderColor: colors.primary },
  productInfo: { flex: 1, paddingRight: 8 },
  productName: { color: colors.text, fontWeight: '700' },
  productMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  productPrice: { color: colors.primaryLight, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 12, borderWidth: 1, marginBottom: 10, paddingVertical: 12 },
  secondaryText: { color: colors.primaryLight, fontWeight: '800' },
  detailRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingVertical: 11 },
  removeText: { color: '#FCA5A5', fontSize: 12, fontWeight: '800' },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  totalRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  totalLabel: { color: colors.muted, fontSize: 16 },
  total: { color: colors.text, fontSize: 28, fontWeight: '900' },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 13, marginTop: 14, paddingVertical: 15 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
