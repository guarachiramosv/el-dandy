import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { addProductStock } from '../api';
import type { Product, Provider, Sucursal } from '../types';
import { branchStocks, decimal, purchaseCost, purchaseFromProduct, validatePurchase } from '../domain/adminInventory';
import PurchaseFields from './PurchaseFields';
import { colors } from '../theme';

type Props = { product: Product; branches: Sucursal[]; providers: Provider[]; initialBranch: string; token: string; onClose: () => void; onSaved: (product: Product) => void };
export default function AddStockModal({ product, branches, providers, initialBranch, token, onClose, onSaved }: Props) {
  const [branchId, setBranchId] = useState(initialBranch);
  const [quantity, setQuantity] = useState('');
  const [purchase, setPurchase] = useState(() => { const draft = purchaseFromProduct(product); return { ...draft, providerId: providers.some(provider => provider.id === draft.providerId) ? draft.providerId : '' }; });
  const [location, setLocation] = useState(() => branchStocks(product, branches).find(branch => branch.id === initialBranch)?.ubicacion || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const branch = branchStocks(product, branches).find(item => item.id === branchId);
  const count = decimal(quantity);
  const save = async () => {
    if (saving) return;
    if (!branchId) return setError('Selecciona la sucursal donde ingresara la compra.');
    if (branch?.registered && !branch.active) return setError('Restaura el producto en esa sucursal antes de ingresar stock.');
    if (!Number.isFinite(count) || count <= 0 || (product.unidadVenta !== 'METRO' && !Number.isSafeInteger(count))) return setError('Indica una cantidad positiva; los productos por unidad requieren enteros.');
    const purchaseError = validatePurchase(purchase);
    if (purchaseError) return setError(purchaseError);
    setSaving(true); setError('');
    try {
      const cost = purchaseCost(purchase);
      const saved = await addProductStock(token, product.id, { sucursalId: branchId, cantidad: count, ubicacion: location.trim() || null, proveedorId: purchase.providerId || null, precioCompraUnitario: cost.unitBs, precioCompraUnitarioReales: cost.unitReales, tipoCambio: cost.exchangeRate, comprobante: purchase.receipt.trim() || null, notas: purchase.notes.trim() || null });
      onSaved(saved);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo registrar el ingreso.'); }
    finally { setSaving(false); }
  };
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
    <View style={styles.overlay}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.card}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.title}>Agregar stock</Text><Text style={styles.text}>{product.codigo} · {product.descripcion}</Text>
        <Text style={styles.label}>Sucursal que recibe la compra</Text>
        <View style={styles.row}>{branches.map(item => <Pressable key={item.id} disabled={saving} onPress={() => { setBranchId(item.id); setLocation(branchStocks(product, branches).find(row => row.id === item.id)?.ubicacion || ''); }} style={[styles.choice, item.id === branchId && styles.selected]}><Text style={styles.text}>{item.nombre}</Text></Pressable>)}</View>
        <Text style={styles.balance}>Stock actual: {branch?.stock || 0} · Despues del ingreso: {Number.isFinite(count) ? (branch?.stock || 0) + count : '—'}</Text>
        <Text style={styles.label}>Cantidad a ingresar ({product.unidadVenta === 'METRO' ? 'metros' : 'unidades'})</Text>
        <TextInput accessibilityLabel="Cantidad a ingresar" editable={!saving} keyboardType={product.unidadVenta === 'METRO' ? 'decimal-pad' : 'number-pad'} value={quantity} onChangeText={setQuantity} style={styles.input} />
        <Text style={styles.label}>Ubicacion / estante</Text><TextInput editable={!saving} value={location} onChangeText={setLocation} style={styles.input} />
        <PurchaseFields value={purchase} onChange={setPurchase} providers={providers} quantity={count} disabled={saving} />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={styles.row}><Pressable disabled={saving} onPress={onClose} style={styles.choice}><Text style={styles.text}>Cancelar</Text></Pressable><Pressable disabled={saving} onPress={save} style={styles.save}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>Registrar ingreso</Text>}</Pressable></View>
      </ScrollView>
    </KeyboardAvoidingView></View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: '#000B', padding: 14 }, card: { maxHeight: '92%', width: '100%', maxWidth: 640, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 18 }, content: { padding: 18, gap: 10 },
  title: { color: colors.text, fontSize: 23, fontWeight: '900' }, text: { color: colors.text, fontWeight: '700' }, label: { color: colors.muted, marginTop: 8 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12 }, selected: { borderColor: colors.primary, backgroundColor: '#352010' }, input: { color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.background },
  balance: { color: colors.primaryLight, marginTop: 10 }, save: { flexGrow: 1, alignItems: 'center', padding: 13, borderRadius: 10, backgroundColor: colors.primary }, error: { color: '#FCA5A5' },
});
