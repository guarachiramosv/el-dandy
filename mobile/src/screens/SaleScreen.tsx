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
import { createSale, getCustomers, getProducts } from '../api';
import { colors } from '../theme';
import { buildThermalReceiptHtml, ReceiptSale } from '../thermalReceipt';
import { CartItem, Customer, PaymentMethod, Product, Session } from '../types';

const paymentMethods: PaymentMethod[] = ['EFECTIVO', 'TRANSFERENCIA', 'QR', 'TARJETA'];
const THERMAL_PRINT_WIDTH_PT = 198;

export default function SaleScreen({ session }: { session: Session }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [search, setSearch] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('EFECTIVO');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSale, setLastSale] = useState<ReceiptSale | null>(null);

  const loadProducts = async () => {
    setError('');
    try {
      setProducts((await getProducts(session.token)).filter((product) => product.stock > 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    getCustomers(session.token)
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, [session.token]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products.slice(0, 12);
    return products
      .filter((product) =>
        `${product.codigo} ${product.descripcion} ${product.marca || ''}`.toLowerCase().includes(term),
      )
      .slice(0, 20);
  }, [products, search]);

  const cartItems = Object.values(cart);
  const total = cartItems.reduce(
    (sum, item) => sum + item.product.precioVenta * item.quantity,
    0,
  );

  const addProduct = (product: Product) => {
    setCart((current) => {
      const existing = current[product.id];
      const nextQuantity = Math.min((existing?.quantity || 0) + 1, product.stock);
      return { ...current, [product.id]: { product, quantity: nextQuantity } };
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((current) => {
      const item = current[productId];
      if (!item) return current;
      const quantity = Math.min(item.product.stock, item.quantity + delta);
      if (quantity <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: { ...item, quantity } };
    });
  };

  const printReceipt = async (sale: ReceiptSale) => {
    try {
      await Print.printAsync({
        html: buildThermalReceiptHtml(sale, session.user.nombre),
        width: THERMAL_PRINT_WIDTH_PT,
      });
    } catch (err) {
      Alert.alert(
        'No se pudo imprimir',
        err instanceof Error ? err.message : 'Revisa que la impresora este disponible en el sistema.',
      );
    }
  };

  const submit = async () => {
    if (!cartItems.length) {
      Alert.alert('Venta vacía', 'Agrega al menos un repuesto.');
      return;
    }
    setSaving(true);
    try {
      const sale = await createSale(session, {
        clienteId: customerId,
        metodoPago: payment,
        descuento: 0,
        items: cartItems.map((item) => ({
          productoId: item.product.id,
          cantidad: item.quantity,
          descuentoItem: 0,
        })),
      });
      setLastSale(sale);
      Alert.alert('Venta registrada', `Total: Bs ${sale.total.toFixed(2)}`, [
        { text: 'Cerrar', style: 'cancel' },
        { text: 'Imprimir ticket', onPress: () => void printReceipt(sale) },
      ]);
      setCart({});
      setCustomerId(null);
      setSearch('');
      setLoading(true);
      await loadProducts();
    } catch (err) {
      Alert.alert('No se pudo registrar', err instanceof Error ? err.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Nueva venta</Text>
      <Text style={styles.caption}>Busca un repuesto y agrégalo al carrito.</Text>

      <TextInput
        onChangeText={setSearch}
        placeholder="Código, descripción o marca"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={search}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.results}>
          {visibleProducts.map((product) => (
            <Pressable key={product.id} onPress={() => addProduct(product)} style={styles.productCard}>
              <View style={styles.productInfo}>
                <Text style={styles.productCode}>{product.codigo}</Text>
                <Text numberOfLines={2} style={styles.productName}>{product.descripcion}</Text>
                <Text style={styles.productMeta}>{product.marca || 'Sin marca'} · Stock {product.stock}</Text>
              </View>
              <View style={styles.productRight}>
                <Text style={styles.price}>Bs {product.precioVenta.toFixed(2)}</Text>
                <Text style={styles.add}>+ Agregar</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Carrito</Text>
        <Text style={styles.itemCount}>{cartItems.length} productos</Text>
      </View>

      <View style={styles.cart}>
        {!cartItems.length && <Text style={styles.empty}>Todavía no agregaste repuestos.</Text>}
        {cartItems.map((item) => (
          <View key={item.product.id} style={styles.cartRow}>
            <View style={styles.cartInfo}>
              <Text style={styles.cartName}>{item.product.descripcion}</Text>
              <Text style={styles.cartPrice}>Bs {item.product.precioVenta.toFixed(2)} c/u</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable onPress={() => changeQuantity(item.product.id, -1)} style={styles.stepButton}>
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.quantity}>{item.quantity}</Text>
              <Pressable onPress={() => changeQuantity(item.product.id, 1)} style={styles.stepButton}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Cliente</Text>
      <Text style={styles.helper}>Opcional para ventas al contado.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.customerOptions}>
        <Pressable
          onPress={() => setCustomerId(null)}
          style={[styles.customerOption, customerId === null && styles.customerOptionActive]}
        >
          <Text style={[styles.customerOptionText, customerId === null && styles.customerOptionTextActive]}>
            Sin cliente
          </Text>
        </Pressable>
        {customers.map((customer) => (
          <Pressable
            key={customer.id}
            onPress={() => setCustomerId(customer.id)}
            style={[styles.customerOption, customerId === customer.id && styles.customerOptionActive]}
          >
            <Text style={[styles.customerOptionText, customerId === customer.id && styles.customerOptionTextActive]}>
              {customer.nombre}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Método de pago</Text>
      <View style={styles.paymentGrid}>
        {paymentMethods.map((method) => (
          <Pressable
            key={method}
            onPress={() => setPayment(method)}
            style={[styles.payment, payment === method && styles.paymentActive]}
          >
            <Text style={[styles.paymentText, payment === method && styles.paymentTextActive]}>
              {method}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.total}>Bs {total.toFixed(2)}</Text>
      </View>
      <Pressable disabled={saving || !cartItems.length} onPress={submit} style={[styles.submit, (!cartItems.length || saving) && styles.disabled]}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Confirmar venta</Text>}
      </Pressable>
      {lastSale && (
        <Pressable onPress={() => void printReceipt(lastSale)} style={styles.printLast}>
          <Text style={styles.printLastText}>Imprimir ultimo ticket 80mm</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 34 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  caption: { color: colors.muted, marginBottom: 14, marginTop: 4 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  error: { color: '#FCA5A5', marginTop: 10 },
  loader: { marginVertical: 30 },
  results: { gap: 8, marginTop: 12 },
  productCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 13,
  },
  productInfo: { flex: 1, paddingRight: 12 },
  productCode: { color: colors.primaryLight, fontSize: 12, fontWeight: '800' },
  productName: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 3 },
  productMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  productRight: { alignItems: 'flex-end' },
  price: { color: colors.text, fontWeight: '800' },
  add: { color: colors.primaryLight, fontSize: 12, fontWeight: '700', marginTop: 7 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 20 },
  itemCount: { color: colors.muted, marginTop: 20 },
  cart: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 14,
  },
  empty: { color: colors.muted, paddingVertical: 20, textAlign: 'center' },
  cartRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', paddingVertical: 13 },
  cartInfo: { flex: 1, paddingRight: 10 },
  cartName: { color: colors.text, fontWeight: '600' },
  cartPrice: { color: colors.muted, fontSize: 12, marginTop: 3 },
  stepper: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  stepButton: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: 8, height: 34, justifyContent: 'center', width: 34 },
  stepText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  quantity: { color: colors.text, fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'center' },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  helper: { color: colors.muted, fontSize: 12, marginTop: 4 },
  customerOptions: { gap: 8, paddingVertical: 10 },
  customerOption: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  customerOptionActive: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderColor: colors.primary },
  customerOptionText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  customerOptionTextActive: { color: '#BFDBFE' },
  payment: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  paymentActive: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderColor: colors.primary },
  paymentText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  paymentTextActive: { color: '#BFDBFE' },
  totalRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  totalLabel: { color: colors.muted, fontSize: 17 },
  total: { color: colors.text, fontSize: 28, fontWeight: '900' },
  submit: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 13, marginTop: 14, paddingVertical: 16 },
  printLast: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 14,
  },
  printLastText: { color: colors.primaryLight, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
