import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL, getCustomerCatalog, getCustomerProfile } from '../api';
import { clearCustomerSession, saveCustomerSession } from '../session';
import { colors } from '../theme';
import { CustomerSession, Product } from '../types';
import ImageViewer from './ImageViewer';
import BrandLogo from '../components/BrandLogo';

type Props = {
  session: CustomerSession;
  onLogout: () => void;
};

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

function money(value: number) {
  return `Bs ${value.toFixed(2)}`;
}

function onlyDigits(value?: string | null) {
  return (value || '').replace(/\D/g, '');
}

function whatsappUrl(product: Product) {
  const message = `Hola, quiero informacion del precio y disponibilidad del repuesto ${product.descripcion} (codigo ${product.codigo}).`;
  const phone = onlyDigits(product.sucursal?.whatsapp);
  return phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export default function CustomerHomeScreen({ session, onLogout }: Props) {
  const [customerSession, setCustomerSession] = useState(session);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const token = customerSession.token;

  const loadCatalog = useCallback(async (term = search) => {
    setError('');
    try {
      setProducts(await getCustomerCatalog(token, term));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catalogo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, token]);

  const refreshProfile = useCallback(async () => {
    try {
      const customer = await getCustomerProfile(token);
      const nextSession = { ...customerSession, customer };
      setCustomerSession(nextSession);
      await saveCustomerSession(nextSession);
    } catch {
      // El catalogo puede seguir funcionando aunque falle la actualizacion del perfil.
    }
  }, [customerSession, token]);

  useEffect(() => {
    loadCatalog('');
    refreshProfile();
  }, [token]);

  const submitSearch = () => {
    setLoading(true);
    loadCatalog(search);
  };

  const logout = () => {
    Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta de cliente?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await clearCustomerSession();
          onLogout();
        },
      },
    ]);
  };

  const askByWhatsapp = (product: Product) => {
    Linking.openURL(whatsappUrl(product));
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const imageUrl = productImageUrl(productImageUrls(item)[0]);
    const lowStock = item.stock <= (item.stockMinimo || 5);
    const productBrand = item.marca?.trim() || 'Sin marca';
    const fallbackLabel = (item.marca || item.descripcion || item.codigo || 'DD').slice(0, 2).toUpperCase();

    return (
      <Pressable onPress={() => setSelectedProduct(item)} style={styles.productCard}>
        {imageUrl ? (
          <Pressable onPress={(event) => {
            event.stopPropagation();
            setViewerImage(imageUrl);
          }}>
            <Image source={{ uri: imageUrl }} style={styles.productImage} />
          </Pressable>
        ) : (
          <View style={styles.productImageFallback}>
            <Text style={styles.productImageFallbackText}>{fallbackLabel}</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <View style={styles.productTopRow}>
            <Text style={styles.productCode}>{item.codigo}</Text>
            <View style={[styles.stockBadge, lowStock ? styles.stockBadgeLow : styles.stockBadgeOk]}>
              <Text style={[styles.stockText, lowStock ? styles.stockTextLow : styles.stockTextOk]}>
                {item.stock} disp.
              </Text>
            </View>
          </View>
          <Text style={styles.productName} numberOfLines={2}>{item.descripcion}</Text>
          <Text style={styles.productMeta} numberOfLines={1}>
            {productBrand} · {item.categoria?.nombre || 'General'}
          </Text>
          <View style={styles.productBottom}>
            <Text style={styles.storeName}>{item.sucursal?.nombre || 'Sucursal'}</Text>
            <Text style={styles.price}>{money(item.precioVenta)}</Text>
          </View>
          <Pressable onPress={() => askByWhatsapp(item)} style={styles.whatsappButton}>
            <LinearGradient colors={['#22C55E', '#16A34A']} style={styles.whatsappGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.whatsappButtonText}>Pedir por WhatsApp</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <LinearGradient colors={[colors.background, '#111111', '#050608']} style={StyleSheet.absoluteFillObject} />
      
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <BrandLogo compact />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.brand}>Diesel Dandy Cliente</Text>
          <Text style={styles.user} numberOfLines={1}>
            Bienvenido, {customerSession.customer.nombre}
          </Text>
        </View>
        <Pressable onPress={logout} style={styles.logout}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.searchSection}>
          <Text style={styles.heading}>Encuentra tu repuesto ideal</Text>
          <View style={styles.searchRow}>
            <TextInput
              onChangeText={setSearch}
              onSubmitEditing={submitSearch}
              placeholder="Buscar por código, marca..."
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.input}
              value={search}
            />
            <Pressable onPress={submitSearch} style={styles.searchButton}>
              <LinearGradient colors={[colors.primary, colors.primarySoft]} style={styles.searchGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={styles.searchButtonText}>Buscar</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />
        ) : (
          <FlatList
            contentContainerStyle={styles.list}
            data={products}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.empty}>No se encontraron productos.</Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                onRefresh={() => {
                  setRefreshing(true);
                  loadCatalog(search);
                }}
                refreshing={refreshing}
                tintColor={colors.primary}
              />
            }
            renderItem={renderProduct}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Modal animationType="slide" transparent visible={!!selectedProduct} onRequestClose={() => setSelectedProduct(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedProduct && (
                <>
                  <View style={styles.modalImageContainer}>
                    {productImageUrl(productImageUrls(selectedProduct)[0]) ? (
                      <Pressable onPress={() => setViewerImage(productImageUrl(productImageUrls(selectedProduct)[0])!)}>
                        <Image source={{ uri: productImageUrl(productImageUrls(selectedProduct)[0])! }} style={styles.modalImage} />
                      </Pressable>
                    ) : (
                      <View style={styles.modalImageFallback}>
                        <Text style={styles.modalImageFallbackText}>Sin imagen</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalCode}>{selectedProduct.codigo}</Text>
                    <Text style={styles.modalTitle}>{selectedProduct.descripcion}</Text>
                    <Text style={styles.modalPrice}>{money(selectedProduct.precioVenta)}</Text>
                    
                    <View style={styles.detailGrid}>
                      <Detail label="Marca" value={selectedProduct.marca?.trim() || 'Sin marca'} />
                      <Detail label="Condición" value={selectedProduct.condicion} />
                      <Detail label="Categoría" value={selectedProduct.categoria?.nombre || 'General'} />
                      <Detail label="Sucursal" value={selectedProduct.sucursal?.nombre || 'Sucursal'} />
                      <Detail label="Stock" value={`${selectedProduct.stock} unidades disponibles`} />
                    </View>
                    
                    <Pressable onPress={() => askByWhatsapp(selectedProduct)} style={styles.modalWhatsappButtonWrap}>
                      <LinearGradient colors={['#22C55E', '#16A34A']} style={styles.modalWhatsappGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                        <Text style={styles.modalWhatsappText}>Pedir información por WhatsApp</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
            <Pressable onPress={() => setSelectedProduct(null)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Cerrar vista</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ImageViewer imageUrl={viewerImage} onClose={() => setViewerImage(null)} />
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    zIndex: 10,
  },
  headerAvatar: { marginRight: 12 },
  headerText: { flex: 1, paddingRight: 12 },
  brand: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0 },
  user: { color: colors.primaryLight, fontSize: 13, fontWeight: '600', marginTop: 2 },
  logout: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  logoutText: { color: '#FCA5A5', fontSize: 13, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 16 },
  searchSection: { marginBottom: 16, marginTop: 8 },
  heading: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 16, letterSpacing: 0 },
  searchRow: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    color: '#fff',
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  searchButton: { borderRadius: 16, overflow: 'hidden' },
  searchGradient: { paddingHorizontal: 20, paddingVertical: 15, justifyContent: 'center', alignItems: 'center' },
  searchButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  error: { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', padding: 12, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  loader: { marginTop: 80 },
  list: { gap: 16, paddingBottom: 40, paddingTop: 8 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, opacity: 0.5, marginBottom: 16 },
  empty: { color: colors.muted, fontSize: 16, fontWeight: '500' },
  productCard: {
    backgroundColor: 'rgba(23, 23, 23, 0.72)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  productImage: { height: 160, width: '100%', backgroundColor: colors.surfaceSoft },
  productImageFallback: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    height: 160,
    justifyContent: 'center',
    width: '100%',
  },
  productImageFallbackText: { color: colors.primaryLight, fontSize: 32, fontWeight: '900', opacity: 0.5 },
  productInfo: { padding: 16 },
  productTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  productCode: { color: colors.primaryLight, fontSize: 12, fontWeight: '800', backgroundColor: 'rgba(249, 115, 22, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stockBadgeOk: { backgroundColor: 'rgba(34, 197, 94, 0.1)' },
  stockBadgeLow: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  stockText: { fontSize: 11, fontWeight: '800' },
  stockTextOk: { color: '#4ADE80' },
  stockTextLow: { color: '#F87171' },
  productName: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  productMeta: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  productBottom: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  storeName: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  price: { color: '#fff', fontSize: 22, fontWeight: '900' },
  whatsappButton: { borderRadius: 14, overflow: 'hidden' },
  whatsappGradient: { paddingVertical: 14, alignItems: 'center' },
  whatsappButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  modalOverlay: { backgroundColor: 'rgba(5, 6, 8, 0.88)', flex: 1, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    maxHeight: '92%',
    padding: 24,
  },
  modalImageContainer: { borderRadius: 24, overflow: 'hidden', marginBottom: 20 },
  modalImage: { backgroundColor: colors.surfaceSoft, height: 260, width: '100%' },
  modalImageFallback: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    height: 260,
    justifyContent: 'center',
    width: '100%',
  },
  modalImageFallbackText: { color: colors.muted, fontWeight: '800', fontSize: 20 },
  modalContent: { paddingHorizontal: 4 },
  modalCode: { color: colors.primaryLight, fontSize: 14, fontWeight: '800' },
  modalTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 8, letterSpacing: 0 },
  modalPrice: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 12 },
  detailGrid: { gap: 12, marginTop: 24 },
  detail: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  detailLabel: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  detailValue: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 4 },
  modalWhatsappButtonWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 24, marginBottom: 8 },
  modalWhatsappGradient: { paddingVertical: 18, alignItems: 'center' },
  modalWhatsappText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  closeButton: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 16, marginTop: 16, paddingVertical: 18 },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
