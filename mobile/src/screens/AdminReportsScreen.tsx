import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Print from 'expo-print';
import { getProductInventoryReport, getSalesHistoryReport, getSucursales } from '../api';
import { colors } from '../theme';
import { ProductInventoryReport, ReportPeriod, SalesHistoryReport, Session, Sucursal } from '../types';

const today = new Date();
const defaultDay = today.toISOString().slice(0, 10);
const defaultMonth = today.toISOString().slice(0, 7);
const defaultYear = String(today.getFullYear());

const periods: Array<{ value: Exclude<ReportPeriod, 'all'>; label: string }> = [
  { value: 'day', label: 'Dia' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Anio' },
];

function money(value?: number) {
  return `Bs ${(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function periodValue(period: Exclude<ReportPeriod, 'all'>, day: string, month: string, year: string) {
  if (period === 'year') return year;
  if (period === 'month') return month;
  return day;
}

function branchNameFrom(item: { usuario?: { sucursal?: { nombre: string } }; sucursal?: { nombre: string } }) {
  return item.usuario?.sucursal?.nombre || item.sucursal?.nombre || 'Sucursal';
}

function paymentLabel(tipoVenta: string, metodoPago: string) {
  return tipoVenta === 'CREDITO' ? 'CREDITO' : metodoPago;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getBranchStock(item: ProductInventoryReport['items'][number], branchName: string) {
  const target = branchName.trim().toLowerCase();
  return item.stockSucursales?.find((branch) => branch.sucursal.trim().toLowerCase() === target)?.stock || 0;
}

function printHtml(report: SalesHistoryReport, inventory: ProductInventoryReport | null, branch: string) {
  const salesRows = report.ventas.flatMap((sale) =>
    (sale.detalles || []).map((detail) => ({
      fecha: new Date(sale.createdAt).toLocaleString('es-BO'),
      vendedor: sale.usuario?.nombre || 'Usuario',
      sucursal: branchNameFrom(sale),
      pago: paymentLabel(sale.tipoVenta, sale.metodoPago),
      codigo: detail.producto?.codigo || detail.tipoLinea || '',
      producto: detail.producto?.descripcion || detail.descripcion || 'Detalle',
      cantidad: detail.cantidad,
      total: detail.subtotal,
    })),
  );
  const inventoryRows = (inventory?.items || []).slice(0, 180);

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
          h1 { margin: 0 0 4px; font-size: 22px; }
          h2 { margin: 22px 0 8px; font-size: 16px; }
          p { margin: 2px 0; color: #4b5563; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0; }
          .stat { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; }
          .label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
          .value { margin-top: 3px; font-weight: 800; color: #111827; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 6px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; font-weight: 800; }
          .right { text-align: right; }
        </style>
      </head>
      <body>
        <h1>Reporte administrativo</h1>
        <p>Periodo: ${escapeHtml(report.label)} · Sucursal: ${escapeHtml(branch)} · Generado: ${escapeHtml(new Date().toLocaleString('es-BO'))}</p>
        <div class="stats">
          <div class="stat"><div class="label">Ventas</div><div class="value">${report.totals.cantidadVentas}</div></div>
          <div class="stat"><div class="label">Efectivo</div><div class="value">${money(report.totals.totalEfectivo)}</div></div>
          <div class="stat"><div class="label">QR</div><div class="value">${money(report.totals.totalQr)}</div></div>
          <div class="stat"><div class="label">Total ventas</div><div class="value">${money(report.totals.totalVentas)}</div></div>
          <div class="stat"><div class="label">Gastos</div><div class="value">${money(report.totals.totalGastos)}</div></div>
          <div class="stat"><div class="label">Queda efectivo</div><div class="value">${money(report.totals.netoEfectivo)}</div></div>
          <div class="stat"><div class="label">Queda QR</div><div class="value">${money(report.totals.netoQr)}</div></div>
          <div class="stat"><div class="label">Unidades</div><div class="value">${report.totals.unidadesVendidas}</div></div>
        </div>
        <h2>Detalle de ventas</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Vendedor</th><th>Sucursal</th><th>Pago</th><th>Codigo</th><th>Producto</th><th class="right">Cant.</th><th class="right">Total</th></tr></thead>
          <tbody>
            ${salesRows.map((row) => `<tr><td>${escapeHtml(row.fecha)}</td><td>${escapeHtml(row.vendedor)}</td><td>${escapeHtml(row.sucursal)}</td><td>${escapeHtml(row.pago)}</td><td>${escapeHtml(row.codigo)}</td><td>${escapeHtml(row.producto)}</td><td class="right">${row.cantidad}</td><td class="right">${money(row.total)}</td></tr>`).join('')}
          </tbody>
        </table>
        <h2>Inventario por sucursal</h2>
        <table>
          <thead><tr><th>Codigo</th><th>Producto</th><th>Estante</th><th class="right">Precio</th><th class="right">Santa Cruz</th><th class="right">Cochabamba</th><th class="right">Total</th></tr></thead>
          <tbody>
            ${inventoryRows.map((item) => `<tr><td>${escapeHtml(item.codigo)}</td><td>${escapeHtml(item.descripcion)}</td><td>${escapeHtml(item.ubicacion || '')}</td><td class="right">${money(item.precioVenta)}</td><td class="right">${getBranchStock(item, 'Santa Cruz')}</td><td class="right">${getBranchStock(item, 'Cochabamba')}</td><td class="right">${item.stockActual}</td></tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

export default function AdminReportsScreen({ session }: { session: Session }) {
  const [period, setPeriod] = useState<Exclude<ReportPeriod, 'all'>>('day');
  const [day, setDay] = useState(defaultDay);
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [sucursalId, setSucursalId] = useState('');
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [salesReport, setSalesReport] = useState<SalesHistoryReport | null>(null);
  const [inventoryReport, setInventoryReport] = useState<ProductInventoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');

  const value = useMemo(() => periodValue(period, day, month, year), [day, month, period, year]);
  const selectedBranch = sucursales.find((item) => item.id === sucursalId)?.nombre || 'Todas';

  const loadReports = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [branches, sales, inventory] = await Promise.all([
        getSucursales(session.token),
        getSalesHistoryReport(session.token, { period, value, sucursalId: sucursalId || undefined }),
        getProductInventoryReport(session.token, { period: 'all', sucursalId: sucursalId || undefined }),
      ]);
      setSucursales(branches);
      setSalesReport(sales);
      setInventoryReport(inventory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los reportes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, session.token, sucursalId, value]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const printReport = async () => {
    if (!salesReport) return;
    setPrinting(true);
    try {
      await Print.printAsync({ html: printHtml(salesReport, inventoryReport, selectedBranch) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo imprimir el reporte.');
    } finally {
      setPrinting(false);
    }
  };

  const topProducts = salesReport?.ventas
    .flatMap((sale) => sale.detalles || [])
    .reduce<Array<{ key: string; codigo: string; nombre: string; cantidad: number; total: number }>>((acc, detail) => {
      const key = detail.producto?.codigo || detail.descripcion || detail.id;
      const current = acc.find((item) => item.key === key);
      if (current) {
        current.cantidad += detail.cantidad;
        current.total += detail.subtotal;
      } else {
        acc.push({
          key,
          codigo: detail.producto?.codigo || detail.tipoLinea || '',
          nombre: detail.producto?.descripcion || detail.descripcion || 'Detalle',
          cantidad: detail.cantidad,
          total: detail.subtotal,
        });
      }
      return acc;
    }, [])
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 8) || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            setRefreshing(true);
            loadReports();
          }}
          refreshing={refreshing}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.heading}>Reportes</Text>
          <Text style={styles.caption}>Ventas, caja e inventario administrativo.</Text>
        </View>
        <Pressable disabled={!salesReport || printing} onPress={printReport} style={[styles.printButton, (!salesReport || printing) && styles.disabled]}>
          <Text style={styles.printButtonText}>{printing ? 'Abriendo...' : 'Imprimir'}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal contentContainerStyle={styles.chipRow} showsHorizontalScrollIndicator={false}>
        {periods.map((option) => (
          <Pressable key={option.value} onPress={() => setPeriod(option.value)} style={[styles.chip, period === option.value && styles.chipActive]}>
            <Text style={[styles.chipText, period === option.value && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <TextInput
        onChangeText={period === 'day' ? setDay : period === 'month' ? setMonth : setYear}
        placeholder={period === 'day' ? 'YYYY-MM-DD' : period === 'month' ? 'YYYY-MM' : 'YYYY'}
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
      />

      <ScrollView horizontal contentContainerStyle={styles.chipRow} showsHorizontalScrollIndicator={false}>
        <Pressable onPress={() => setSucursalId('')} style={[styles.chip, sucursalId === '' && styles.chipActive]}>
          <Text style={[styles.chipText, sucursalId === '' && styles.chipTextActive]}>Todas</Text>
        </Pressable>
        {sucursales.map((sucursal) => (
          <Pressable key={sucursal.id} onPress={() => setSucursalId(sucursal.id)} style={[styles.chip, sucursalId === sucursal.id && styles.chipActive]}>
            <Text style={[styles.chipText, sucursalId === sucursal.id && styles.chipTextActive]}>{sucursal.nombre}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable onPress={loadReports} disabled={loading} style={[styles.updateButton, loading && styles.disabled]}>
        <Text style={styles.updateButtonText}>{loading ? 'Cargando...' : 'Actualizar reportes'}</Text>
      </Pressable>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {loading && !salesReport ? (
        <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />
      ) : salesReport ? (
        <>
          <View style={styles.statsGrid}>
            <Stat label="Ventas" value={String(salesReport.totals.cantidadVentas)} />
            <Stat label="Efectivo" value={money(salesReport.totals.totalEfectivo)} />
            <Stat label="QR" value={money(salesReport.totals.totalQr)} />
            <Stat label="Credito" value={money(salesReport.totals.totalCredito)} />
            <Stat label="Total ventas" value={money(salesReport.totals.totalVentas)} />
            <Stat label="Gastos" value={money(salesReport.totals.totalGastos)} />
            <Stat label="Queda efectivo" value={money(salesReport.totals.netoEfectivo)} />
            <Stat label="Queda QR" value={money(salesReport.totals.netoQr)} />
          </View>

          <Section title="Nota al cerrar caja">
            {salesReport.cierres.length > 0 ? salesReport.cierres.map((closing) => (
              <View key={closing.id} style={styles.noteCard}>
                <Text style={styles.noteTitle}>{closing.usuario?.nombre || 'Vendedor'} / {branchNameFrom(closing)}</Text>
                <Text style={styles.noteText}>{closing.notas?.trim() || 'Sin nota registrada.'}</Text>
              </View>
            )) : <Text style={styles.emptyText}>Sin cierre de caja registrado para este periodo.</Text>}
          </Section>

          <Section title="Productos vendidos">
            {topProducts.length > 0 ? topProducts.map((item) => (
              <View key={item.key} style={styles.rowCard}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.codigo || 'SERVICIO'} - {item.nombre}</Text>
                  <Text style={styles.rowMeta}>Cantidad {item.cantidad}</Text>
                </View>
                <Text style={styles.rowAmount}>{money(item.total)}</Text>
              </View>
            )) : <Text style={styles.emptyText}>Sin ventas en este periodo.</Text>}
          </Section>

          <Section title="Gastos registrados">
            {salesReport.gastos.length > 0 ? salesReport.gastos.slice(0, 12).map((expense) => (
              <View key={expense.id} style={styles.rowCard}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{expense.motivo}</Text>
                  <Text style={styles.rowMeta}>{expense.usuario?.nombre || 'Usuario'} · {expense.metodoPago}</Text>
                </View>
                <Text style={styles.rowAmount}>{money(expense.monto)}</Text>
              </View>
            )) : <Text style={styles.emptyText}>Sin gastos registrados.</Text>}
          </Section>

          <Section title="Inventario por sucursal">
            {inventoryReport && (
              <View style={styles.inventorySummary}>
                <Stat label="Productos" value={String(inventoryReport.totals.productos)} />
                <Stat label="Stock total" value={String(inventoryReport.totals.stockActual)} />
              </View>
            )}
            {inventoryReport?.items.slice(0, 30).map((item) => (
              <View key={item.productoId} style={styles.inventoryCard}>
                <Text style={styles.rowTitle}>{item.codigo} - {item.descripcion}</Text>
                <Text style={styles.rowMeta}>{item.ubicacion || 'Sin estante'} · {money(item.precioVenta)}</Text>
                <View style={styles.branchRow}>
                  <Text style={styles.branchPill}>Santa Cruz: {getBranchStock(item, 'Santa Cruz')}</Text>
                  <Text style={styles.branchPill}>Cochabamba: {getBranchStock(item, 'Cochabamba')}</Text>
                  <Text style={styles.branchPill}>Total: {item.stockActual}</Text>
                </View>
              </View>
            ))}
          </Section>
        </>
      ) : (
        <Text style={styles.emptyText}>Sin datos.</Text>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  titleText: { flex: 1 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '900' },
  caption: { color: colors.muted, marginTop: 4 },
  printButton: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  printButtonText: { color: '#fff', fontWeight: '900' },
  chipRow: { gap: 8, paddingTop: 14 },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: colors.primaryLight },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  updateButton: { alignItems: 'center', backgroundColor: colors.surfaceSoft, borderRadius: 12, marginTop: 12, paddingVertical: 13 },
  updateButtonText: { color: colors.text, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  error: { color: '#FCA5A5', marginTop: 12 },
  loader: { marginTop: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  stat: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: '46%',
    padding: 12,
  },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 4 },
  section: { marginTop: 20 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  noteCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  noteTitle: { color: '#FCD34D', fontWeight: '900' },
  noteText: { color: colors.text, marginTop: 5 },
  rowCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    padding: 12,
  },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontWeight: '900' },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  rowAmount: { color: colors.primaryLight, fontWeight: '900' },
  emptyText: { color: colors.muted },
  inventorySummary: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inventoryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  branchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  branchPill: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 999,
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
