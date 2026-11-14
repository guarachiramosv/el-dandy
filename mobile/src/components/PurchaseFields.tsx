import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import type { Provider } from '../types';
import { purchaseCost, type PurchaseDraft } from '../domain/adminInventory';

type Props = { value: PurchaseDraft; onChange: (value: PurchaseDraft) => void; providers: Provider[]; quantity?: number; details?: boolean; disabled?: boolean };
export default function PurchaseFields({ value, onChange, providers, quantity, details = true, disabled = false }: Props) {
  const cost = purchaseCost(value);
  const set = (field: keyof PurchaseDraft, text: string) => onChange({ ...value, [field]: text });
  return <View style={styles.section}>
    <Text style={styles.title}>Costo de compra</Text>
    <Text style={styles.label}>Moneda de compra</Text>
    <View style={styles.row}>{([{ id: 'BOB', label: 'Bolivianos · Bs' }, { id: 'BRL', label: 'Reales · R$' }] as const).map(option =>
      <Pressable key={option.id} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: value.currency === option.id }} onPress={() => { if (value.currency !== option.id) onChange({ ...value, currency: option.id, price: '' }); }} style={[styles.choice, value.currency === option.id && styles.selected]}>
        <Text style={styles.text}>{option.label}</Text>
      </Pressable>)}</View>
    <Text style={styles.label}>Costo unitario ({value.currency === 'BRL' ? 'R$' : 'Bs'})</Text>
    <TextInput accessibilityLabel="Costo unitario de compra" editable={!disabled} keyboardType="decimal-pad" value={value.price} onChangeText={text => set('price', text)} placeholder="0,00" placeholderTextColor={colors.muted} style={styles.input} />
    {value.currency === 'BRL' && <>
      <Text style={styles.label}>Tipo de cambio: 1 R$ equivale a cuantos Bs</Text>
      <TextInput accessibilityLabel="Bolivianos por un real" editable={!disabled} keyboardType="decimal-pad" value={value.exchangeRate} onChangeText={text => set('exchangeRate', text)} placeholder="Ej. 1,50" placeholderTextColor={colors.muted} style={styles.input} />
      <Text style={styles.result}>Costo unitario convertido: {Number.isFinite(cost.unitBs) ? `Bs ${cost.unitBs.toFixed(2)}` : 'Completa precio y tipo de cambio'}</Text>
    </>}
    {Number.isFinite(quantity) && Number.isFinite(cost.unitBs) && <Text style={styles.result}>Total de compra: Bs {(cost.unitBs * (quantity || 0)).toFixed(2)}{value.currency === 'BRL' ? ` · R$ ${(cost.unitReales * (quantity || 0)).toFixed(2)}` : ''}</Text>}
    <Text style={styles.label}>Proveedor (opcional)</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable disabled={disabled} onPress={() => set('providerId', '')} style={[styles.choice, !value.providerId && styles.selected]}><Text style={styles.text}>Sin proveedor</Text></Pressable>
      {providers.map(provider => <Pressable key={provider.id} disabled={disabled} onPress={() => set('providerId', provider.id)} style={[styles.choice, value.providerId === provider.id && styles.selected]}><Text style={styles.text}>{provider.nombre}</Text></Pressable>)}
    </ScrollView>
    {details && <Text style={styles.label}>Selecciona un proveedor para registrar tambien la compra.</Text>}
    {details && <>
      <Text style={styles.label}>Comprobante (opcional)</Text><TextInput editable={!disabled} value={value.receipt} onChangeText={text => set('receipt', text)} maxLength={160} style={styles.input} />
      <Text style={styles.label}>Notas de compra (opcional)</Text><TextInput editable={!disabled} value={value.notes} onChangeText={text => set('notes', text)} maxLength={300} multiline style={styles.input} />
    </>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 8, marginTop: 14, padding: 12, backgroundColor: colors.surfaceSoft, borderRadius: 12 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' }, label: { color: colors.muted, marginTop: 6, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8 }, choice: { padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }, selected: { borderColor: colors.primary, backgroundColor: '#352010' },
  text: { color: colors.text, fontWeight: '700' }, input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text },
  result: { color: colors.primaryLight, fontSize: 14, fontWeight: '700' },
});
