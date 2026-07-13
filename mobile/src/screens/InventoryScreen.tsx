import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { API_URL, getProducts } from '../api';
import { colors } from '../theme';
import { Product, Session } from '../types';
import ImageViewer from './ImageViewer';

const apiOrigin = API_URL.replace(/\/api$/, '');

function productImageUrl(image?: string | null) {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/uploads/')) return `${apiOrigin}${image}`;
  return `${apiOrigin}/uploads/${image.replace(/^\/+/, '')}`;
}

function productImageUrls(product?: Product | null) {
  const gallery = product?.imagenes?.map((image) => image.url).filter(Boolean) || [];
  if (gallery.length > 0) return gallery;
  return product?.imagen ? [product.imagen] : [];
}

export default function InventoryScreen({ session }: { session: Session }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const load = useCallback(async (term = search) => {
    setError('');
    try {
      setProducts(await getProducts(session.token, term));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, session.token]);

  useEffect(() => {
    load('');
  }, [session.token]);

  const submitSearch = () => {
    setLoading(true);
    load(search);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Consulta de stock</Text>
      <Text style={styles.caption}>Busca por codigo, descripcion o marca.</Text>
      <View style={styles.searchRow}>
        <TextInput
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          placeholder="Ej. filtro Volvo"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={styles.input}
          value={search}
        />
        <Pressable onPress={submitSearch} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Buscar</Text>
        </Pressable>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={products}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No encontramos repuestos.</Text>}
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
          renderItem={({ item }) => {
            const lowStock = item.stock <= item.stockMinimo;
            const imageUrl = productImageUrl(productImageUrls(item)[0]);

            return (
              <View style={styles.card}>
                <View style={styles.cardBody}>
                  {imageUrl ? (
                    <Pressable onPress={() => setViewerImage(imageUrl)} style={styles.productImageWrap}>
                      <Image source={{ uri: imageUrl }} style={styles.productImage} />
                    </Pressable>
                  ) : (
                    <View style={styles.productImageFallback}>
                      <Text style={styles.productImageFallbackText}>{(item.marca || item.descripcion || 'PR').slice(0, 2).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTop}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.code}>{item.codigo}</Text>
                      </View>
                      <Text style={[styles.stock, lowStock && styles.stockLow]}>
                        {item.stock} disponibles
                      </Text>
                    </View>
                    <Text style={styles.productName}>{item.descripcion}</Text>
                    <Text style={styles.meta}>
                      {item.marca || 'Sin marca'} - {item.condicion} - {item.categoria?.nombre || 'Sin categoria'}
                    </Text>
                    <View style={styles.cardBottom}>
                      <Text style={styles.branch}>{item.sucursal?.nombre || 'Sucursal'}</Text>
                      <Text style={styles.price}>Bs {item.precioVenta.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
      <ImageViewer imageUrl={viewerImage} onClose={() => setViewerImage(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  caption: { color: colors.muted, marginBottom: 14, marginTop: 4 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  searchButtonText: { color: '#fff', fontWeight: '700' },
  loader: { marginTop: 50 },
  error: { color: '#FCA5A5', marginTop: 12 },
  list: { gap: 10, paddingBottom: 24, paddingTop: 14 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
  },
  cardBody: { flexDirection: 'row', gap: 12 },
  cardInfo: { flex: 1 },
  productImageWrap: { borderRadius: 12, overflow: 'hidden' },
  productImage: { backgroundColor: colors.surfaceSoft, borderRadius: 12, height: 86, width: 86 },
  productImageFallback: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 12,
    height: 86,
    justifyContent: 'center',
    width: 86,
  },
  productImageFallbackText: { color: colors.primaryLight, fontSize: 18, fontWeight: '900', opacity: 0.7 },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  codeBadge: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  code: { color: colors.primaryLight, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontWeight: '700' },
  stock: { color: colors.success, fontSize: 13, fontWeight: '700' },
  stockLow: { color: '#FCA5A5' },
  productName: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 12 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  cardBottom: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  branch: { color: '#CBD5E1', flex: 1, fontSize: 13 },
  price: { color: colors.primaryLight, fontSize: 17, fontWeight: '800' },
});
