import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createProduct,
  deleteProduct,
  getAdminProducts,
  getCategories,
  getSucursales,
  updateProduct,
  uploadProductImages,
  type ProductImageUpload,
} from '../api';
import { colors } from '../theme';
import {
  Category,
  Product,
  ProductInput,
  ProductStatusFilter,
  Session,
  Sucursal,
} from '../types';
import * as ImagePicker from 'expo-image-picker';
import ImageViewer from './ImageViewer';

type FormState = {
  codigo: string;
  descripcion: string;
  marca: string;
  condicion: 'NUEVO' | 'USADO';
  stock: string;
  stockMinimo: string;
  precioCompra: string;
  precioVenta: string;
  categoriaId: string;
  sucursalId: string;
  imagen: string;
};

const emptyForm: FormState = {
  codigo: '',
  descripcion: '',
  marca: 'Universal',
  condicion: 'NUEVO',
  stock: '0',
  stockMinimo: '5',
  precioCompra: '',
  precioVenta: '',
  categoriaId: '',
  sucursalId: '',
  imagen: '',
};

const statusOptions: Array<{ value: ProductStatusFilter; label: string }> = [
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'discontinued', label: 'Descontinuados' },
  { value: 'all', label: 'Todos' },
];

const apiOrigin = process.env.EXPO_PUBLIC_API_URL
  ? process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '')
  : 'http://192.168.0.4:4000';

function money(value?: number) {
  return `Bs ${(value || 0).toFixed(2)}`;
}

function productToForm(product: Product): FormState {
  return {
    codigo: product.codigo,
    descripcion: product.descripcion,
    marca: product.marca,
    condicion: product.condicion === 'USADO' ? 'USADO' : 'NUEVO',
    stock: String(product.stock ?? 0),
    stockMinimo: String(product.stockMinimo ?? 5),
    precioCompra: String(product.precioCompra ?? ''),
    precioVenta: String(product.precioVenta ?? ''),
    categoriaId: product.categoriaId || product.categoria?.id || '',
    sucursalId: product.sucursalId || product.sucursal?.id || '',
    imagen: product.imagen || '',
  };
}

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

function uploadFromAsset(asset: ImagePicker.ImagePickerAsset): ProductImageUpload {
  const name = asset.fileName || asset.uri.split('/').pop() || 'producto.jpg';
  const extension = name.split('.').pop()?.toLowerCase();
  const fallbackType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  return {
    uri: asset.uri,
    name,
    type: asset.mimeType || fallbackType,
  };
}

function formToInput(form: FormState): ProductInput {
  return {
    codigo: form.codigo.trim(),
    descripcion: form.descripcion.trim(),
    marca: form.marca.trim(),
    condicion: form.condicion,
    stock: Number(form.stock),
    stockMinimo: Number(form.stockMinimo),
    precioCompra: Number(form.precioCompra),
    precioVenta: Number(form.precioVenta),
    categoriaId: form.categoriaId,
    sucursalId: form.sucursalId,
    imagen: form.imagen.trim() || null,
  };
}

export default function AdminProductsScreen({ session }: { session: Session }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductStatusFilter>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const token = session.token;

  const defaultCategoryId = categories[0]?.id || '';
  const defaultSucursalId = sucursales[0]?.id || '';

  const loadCatalogs = useCallback(async () => {
    const [nextCategories, nextSucursales] = await Promise.all([
      getCategories(token),
      getSucursales(token),
    ]);
    setCategories(nextCategories);
    setSucursales(nextSucursales);
    setForm((current) => ({
      ...current,
      categoriaId: current.categoriaId || nextCategories[0]?.id || '',
      sucursalId: current.sucursalId || nextSucursales[0]?.id || '',
    }));
  }, [token]);

  const loadProducts = useCallback(async (term = search, nextStatus = status) => {
    setError('');
    try {
      setProducts(await getAdminProducts(token, term, nextStatus));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar productos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, status, token]);

  useEffect(() => {
    loadCatalogs().catch((err) => {
      setError(err instanceof Error ? err.message : 'No se pudo cargar categorias o sucursales.');
    });
    loadProducts('', 'active');
  }, [token]);

  const formReady = useMemo(
    () => categories.length > 0 && sucursales.length > 0,
    [categories.length, sucursales.length],
  );

  const openCreate = () => {
    setEditingProduct(null);
    setSelectedImages([]);
    setForm({
      ...emptyForm,
      categoriaId: defaultCategoryId,
      sucursalId: defaultSucursalId,
    });
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setSelectedImages([]);
    setForm(productToForm(product));
    setModalOpen(true);
  };

  const openView = (product: Product) => {
    setViewProduct(product);
  };

  const submitSearch = () => {
    setLoading(true);
    loadProducts(search, status);
  };

  const changeStatus = (nextStatus: ProductStatusFilter) => {
    setStatus(nextStatus);
    setLoading(true);
    loadProducts(search, nextStatus);
  };

  const validate = () => {
    const input = formToInput(form);
    if (!input.codigo || !input.descripcion || !input.marca) {
      return 'Codigo, descripcion y marca son requeridos.';
    }
    if (!input.categoriaId || !input.sucursalId) {
      return 'Selecciona categoria y sucursal.';
    }
    if (!Number.isFinite(input.stock) || input.stock < 0 || !Number.isInteger(input.stock)) {
      return 'Stock debe ser un numero entero mayor o igual a 0.';
    }
    if (!Number.isFinite(input.stockMinimo) || input.stockMinimo < 0 || !Number.isInteger(input.stockMinimo)) {
      return 'Stock minimo debe ser un numero entero mayor o igual a 0.';
    }
    if (!Number.isFinite(input.precioCompra) || input.precioCompra <= 0) {
      return 'Precio de compra debe ser mayor a 0.';
    }
    if (!Number.isFinite(input.precioVenta) || input.precioVenta <= 0) {
      return 'Precio de venta debe ser mayor a 0.';
    }
    return '';
  };

  const pickImage = async (source: 'camera' | 'library') => {
    setError('');
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(source === 'camera' ? 'Permite acceso a la camara.' : 'Permite acceso a la galeria.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            cameraType: ImagePicker.CameraType.back,
            mediaTypes: ['images'],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: true,
            mediaTypes: ['images'],
            quality: 0.8,
            selectionLimit: 0,
          });

    if (!result.canceled) {
      setSelectedImages((current) => [...current, ...result.assets]);
    }
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
  };

  const saveProduct = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const input = formToInput(form);
      let saved = editingProduct
        ? await updateProduct(token, editingProduct.id, input)
        : await createProduct(token, input);

      if (selectedImages.length > 0) {
        const upload = await uploadProductImages(token, saved.id, selectedImages.map(uploadFromAsset));
        saved = upload.product;
      }

      setProducts((current) => {
        if (editingProduct) return current.map((item) => (item.id === saved.id ? saved : item));
        return [saved, ...current];
      });
      setModalOpen(false);
      setEditingProduct(null);
      setSelectedImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (product: Product) => {
    Alert.alert('Eliminar producto', `Se eliminara ${product.codigo} de la lista activa.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await deleteProduct(token, product.id);
            setProducts((current) =>
              status === 'active'
                ? current.filter((item) => item.id !== product.id)
                : current.map((item) => (item.id === updated.id ? updated : item)),
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo eliminar el producto.');
          }
        },
      },
    ]);
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const lowStock = item.stock <= (item.stockMinimo || 5);
    const inactive = item.estado === 'INACTIVO';
    const discontinued = item.estado === 'DESCONTINUADO';
    const imageUrl = productImageUrl(productImageUrls(item)[0]);

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.codeBadge}>
            <Text style={styles.code}>{item.codigo}</Text>
          </View>
          <Text style={[styles.statusText, inactive && styles.statusInactive, discontinued && styles.statusDiscontinued]}>
            {item.estado || 'ACTIVO'}
          </Text>
        </View>
        <View style={styles.productSummary}>
          {imageUrl ? (
            <Pressable onPress={() => setViewerImage(imageUrl)} style={styles.listImageWrap}>
              <Image source={{ uri: imageUrl }} style={styles.listImage} />
            </Pressable>
          ) : (
            <View style={styles.listImageFallback}>
              <Text style={styles.listImageFallbackText}>{item.marca.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.productSummaryText}>
            <Text style={styles.productName}>{item.descripcion}</Text>
            <Text style={styles.meta}>
              {item.marca} - {item.condicion} - {item.categoria?.nombre || 'Sin categoria'}
            </Text>
            <View style={styles.cardBottom}>
              <Text style={styles.branch}>{item.sucursal?.nombre || 'Sucursal'}</Text>
              <Text style={styles.price}>{money(item.precioVenta)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.stockRow}>
          <Text style={[styles.stock, lowStock && styles.stockLow]}>
            Stock {item.stock} / min. {item.stockMinimo}
          </Text>
          <Text style={styles.cost}>Compra {money(item.precioCompra)}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => openView(item)} style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>Ver</Text>
          </Pressable>
          <Pressable onPress={() => openEdit(item)} style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>Editar</Text>
          </Pressable>
          {(item.estado === 'ACTIVO' || !item.estado) && (
            <Pressable onPress={() => confirmDelete(item)} style={styles.dangerAction}>
              <Text style={styles.dangerActionText}>Eliminar</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.titleTextWrap}>
          <Text style={styles.heading}>Productos</Text>
          <Text style={styles.caption}>Vista admin para consulta y CRUD.</Text>
        </View>
        <Pressable disabled={!formReady} onPress={openCreate} style={[styles.newButton, !formReady && styles.disabled]}>
          <Text style={styles.newButtonText}>Nuevo</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          placeholder="Codigo, descripcion o marca"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={styles.input}
          value={search}
        />
        <Pressable onPress={submitSearch} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Buscar</Text>
        </Pressable>
      </View>

      <ScrollView horizontal contentContainerStyle={styles.statusTabs} showsHorizontalScrollIndicator={false}>
        {statusOptions.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => changeStatus(option.value)}
            style={[styles.statusTab, status === option.value && styles.statusTabActive]}
          >
            <Text style={[styles.statusTabText, status === option.value && styles.statusTabTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={products}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No hay productos para mostrar.</Text>}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                setRefreshing(true);
                loadProducts(search, status);
              }}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          renderItem={renderProduct}
        />
      )}

      <Modal animationType="slide" transparent visible={modalOpen} onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingProduct ? 'Editar producto' : 'Nuevo producto'}</Text>
              <Field label="Codigo" value={form.codigo} onChangeText={(value) => setForm((current) => ({ ...current, codigo: value }))} />
              <Field label="Descripcion" value={form.descripcion} onChangeText={(value) => setForm((current) => ({ ...current, descripcion: value }))} />
              <Field label="Marca" value={form.marca} onChangeText={(value) => setForm((current) => ({ ...current, marca: value }))} />

              <Text style={styles.fieldLabel}>Condicion</Text>
              <View style={styles.toggleRow}>
                {(['NUEVO', 'USADO'] as const).map((condition) => (
                  <Pressable
                    key={condition}
                    onPress={() => setForm((current) => ({ ...current, condicion: condition }))}
                    style={[styles.toggleButton, form.condicion === condition && styles.toggleButtonActive]}
                  >
                    <Text style={[styles.toggleText, form.condicion === condition && styles.toggleTextActive]}>{condition}</Text>
                  </Pressable>
                ))}
              </View>

              <Field label="Stock" keyboardType="number-pad" value={form.stock} onChangeText={(value) => setForm((current) => ({ ...current, stock: value }))} />
              <Field label="Stock minimo" keyboardType="number-pad" value={form.stockMinimo} onChangeText={(value) => setForm((current) => ({ ...current, stockMinimo: value }))} />
              <Field label="Precio compra" keyboardType="decimal-pad" value={form.precioCompra} onChangeText={(value) => setForm((current) => ({ ...current, precioCompra: value }))} />
              <Field label="Precio venta" keyboardType="decimal-pad" value={form.precioVenta} onChangeText={(value) => setForm((current) => ({ ...current, precioVenta: value }))} />

              <Text style={styles.fieldLabel}>Categoria</Text>
              <ScrollView horizontal contentContainerStyle={styles.choiceRow} showsHorizontalScrollIndicator={false}>
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() => setForm((current) => ({ ...current, categoriaId: category.id }))}
                    style={[styles.choiceButton, form.categoriaId === category.id && styles.choiceButtonActive]}
                  >
                    <Text style={[styles.choiceText, form.categoriaId === category.id && styles.choiceTextActive]}>
                      {category.nombre}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Sucursal</Text>
              <ScrollView horizontal contentContainerStyle={styles.choiceRow} showsHorizontalScrollIndicator={false}>
                {sucursales.map((sucursal) => (
                  <Pressable
                    key={sucursal.id}
                    onPress={() => setForm((current) => ({ ...current, sucursalId: sucursal.id }))}
                    style={[styles.choiceButton, form.sucursalId === sucursal.id && styles.choiceButtonActive]}
                  >
                    <Text style={[styles.choiceText, form.sucursalId === sucursal.id && styles.choiceTextActive]}>
                      {sucursal.nombre}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Imagen del producto</Text>
              <View style={styles.imageBox}>
                {selectedImages[0]?.uri ? (
                  <Pressable onPress={() => setViewerImage(selectedImages[0].uri)} style={styles.previewPressable}>
                    <Image source={{ uri: selectedImages[0].uri }} style={styles.previewImage} />
                  </Pressable>
                ) : productImageUrl(productImageUrls(editingProduct)[0] || form.imagen) ? (
                  <Pressable onPress={() => setViewerImage(productImageUrl(productImageUrls(editingProduct)[0] || form.imagen)!)} style={styles.previewPressable}>
                    <Image source={{ uri: productImageUrl(productImageUrls(editingProduct)[0] || form.imagen)! }} style={styles.previewImage} />
                  </Pressable>
                ) : (
                  <View style={styles.previewFallback}>
                    <Text style={styles.previewFallbackText}>Sin imagen</Text>
                  </View>
                )}
              </View>
              {(productImageUrls(editingProduct).length > 0 || selectedImages.length > 0) && (
                <ScrollView horizontal contentContainerStyle={styles.thumbRow} showsHorizontalScrollIndicator={false}>
                  {productImageUrls(editingProduct).map((image, index) => (
                    <Pressable key={`${image}-${index}`} onPress={() => setViewerImage(productImageUrl(image)!)}>
                      <Image source={{ uri: productImageUrl(image)! }} style={styles.thumbImage} />
                    </Pressable>
                  ))}
                  {selectedImages.map((image, index) => (
                    <View key={`${image.uri}-${index}`} style={styles.thumbWrap}>
                      <Pressable onPress={() => setViewerImage(image.uri)}>
                        <Image source={{ uri: image.uri }} style={styles.thumbImage} />
                      </Pressable>
                      <Pressable onPress={() => removeSelectedImage(index)} style={styles.removeThumb}>
                        <Text style={styles.removeThumbText}>x</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={styles.imageActions}>
                <Pressable disabled={saving} onPress={() => pickImage('camera')} style={styles.imageButton}>
                  <Text style={styles.imageButtonText}>Tomar foto</Text>
                </Pressable>
                <Pressable disabled={saving} onPress={() => pickImage('library')} style={styles.imageButton}>
                  <Text style={styles.imageButtonText}>Galeria</Text>
                </Pressable>
              </View>

              <View style={styles.modalActions}>
                <Pressable disabled={saving} onPress={() => setModalOpen(false)} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable disabled={saving} onPress={saveProduct} style={[styles.saveButton, saving && styles.disabled]}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={!!viewProduct} onRequestClose={() => setViewProduct(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.form}>
              {viewProduct && (
                <>
                  <Text style={styles.modalTitle}>Detalle del producto</Text>
                  <View style={styles.imageBox}>
                    {productImageUrl(productImageUrls(viewProduct)[0]) ? (
                      <Pressable onPress={() => setViewerImage(productImageUrl(productImageUrls(viewProduct)[0])!)} style={styles.previewPressable}>
                        <Image source={{ uri: productImageUrl(productImageUrls(viewProduct)[0])! }} style={styles.previewImage} />
                      </Pressable>
                    ) : (
                      <View style={styles.previewFallback}>
                        <Text style={styles.previewFallbackText}>Sin imagen</Text>
                      </View>
                    )}
                  </View>
                  {productImageUrls(viewProduct).length > 1 && (
                    <ScrollView horizontal contentContainerStyle={styles.thumbRow} showsHorizontalScrollIndicator={false}>
                      {productImageUrls(viewProduct).map((image, index) => (
                        <Pressable key={`${image}-${index}`} onPress={() => setViewerImage(productImageUrl(image)!)}>
                          <Image source={{ uri: productImageUrl(image)! }} style={styles.thumbImage} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                  <Detail label="Codigo" value={viewProduct.codigo} />
                  <Detail label="Descripcion" value={viewProduct.descripcion} />
                  <Detail label="Marca" value={viewProduct.marca} />
                  <Detail label="Condicion" value={viewProduct.condicion} />
                  <Detail label="Stock" value={`${viewProduct.stock} unidades`} />
                  <Detail label="Stock minimo" value={`${viewProduct.stockMinimo} unidades`} />
                  <Detail label="Precio compra" value={money(viewProduct.precioCompra)} />
                  <Detail label="Precio venta" value={money(viewProduct.precioVenta)} />
                  <Detail label="Categoria" value={viewProduct.categoria?.nombre || 'Sin categoria'} />
                  <Detail label="Sucursal" value={viewProduct.sucursal?.nombre || 'Sucursal'} />
                  <View style={styles.modalActions}>
                    <Pressable onPress={() => setViewProduct(null)} style={styles.cancelButton}>
                      <Text style={styles.cancelButtonText}>Cerrar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const product = viewProduct;
                        setViewProduct(null);
                        openEdit(product);
                      }}
                      style={styles.saveButton}
                    >
                      <Text style={styles.saveButtonText}>Editar</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ImageViewer imageUrl={viewerImage} onClose={() => setViewerImage(null)} />
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType || 'default'}
        onChangeText={onChangeText}
        placeholderTextColor={colors.muted}
        style={styles.formInput}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  titleTextWrap: { flex: 1 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  caption: { color: colors.muted, marginTop: 4 },
  newButton: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  newButtonText: { color: '#fff', fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
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
  searchButton: { backgroundColor: colors.primary, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 16 },
  searchButtonText: { color: '#fff', fontWeight: '800' },
  statusTabs: { gap: 8, paddingBottom: 8, paddingTop: 12 },
  statusTab: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  statusTabActive: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderColor: colors.primary },
  statusTabText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  statusTabTextActive: { color: colors.primaryLight },
  loader: { marginTop: 50 },
  error: { color: '#FCA5A5', marginTop: 10 },
  list: { gap: 10, paddingBottom: 24, paddingTop: 8 },
  empty: { color: colors.muted, marginTop: 40, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
  },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  codeBadge: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  code: { color: colors.primaryLight, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontWeight: '800' },
  statusText: { color: colors.success, fontSize: 12, fontWeight: '900' },
  statusInactive: { color: '#FCA5A5' },
  statusDiscontinued: { color: '#FBBF24' },
  productSummary: { flexDirection: 'row', gap: 12, marginTop: 12 },
  productSummaryText: { flex: 1 },
  listImageWrap: { borderRadius: 12, overflow: 'hidden' },
  listImage: { backgroundColor: colors.surfaceSoft, borderRadius: 12, height: 86, width: 86 },
  listImageFallback: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 12,
    height: 86,
    justifyContent: 'center',
    width: 86,
  },
  listImageFallbackText: { color: colors.primaryLight, fontSize: 18, fontWeight: '900', opacity: 0.7 },
  productName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  cardBottom: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  branch: { color: '#CBD5E1', flex: 1, fontSize: 13 },
  price: { color: colors.primaryLight, fontSize: 17, fontWeight: '900' },
  stockRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  stock: { color: colors.success, fontSize: 13, fontWeight: '800' },
  stockLow: { color: '#FCA5A5' },
  cost: { color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  secondaryAction: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryActionText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  dangerAction: { backgroundColor: '#7F1D1D', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  dangerActionText: { color: '#FECACA', fontSize: 12, fontWeight: '900' },
  primaryAction: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  primaryActionText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  modalOverlay: { backgroundColor: 'rgba(5, 6, 8, 0.88)', flex: 1, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '92%',
  },
  form: { padding: 18, paddingBottom: 28 },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: 14 },
  fieldLabel: { color: colors.muted, fontSize: 13, fontWeight: '800', marginBottom: 6, marginTop: 10 },
  formInput: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  toggleButtonActive: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderColor: colors.primary },
  toggleText: { color: colors.muted, fontWeight: '900' },
  toggleTextActive: { color: colors.primaryLight },
  choiceRow: { gap: 8, paddingBottom: 2 },
  choiceButton: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  choiceButtonActive: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderColor: colors.primary },
  choiceText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  choiceTextActive: { color: colors.primaryLight },
  imageBox: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 190,
    marginTop: 4,
    overflow: 'hidden',
  },
  previewPressable: { height: '100%', width: '100%' },
  previewImage: { height: '100%', width: '100%' },
  previewFallback: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  previewFallbackText: { color: colors.muted, fontSize: 16, fontWeight: '800' },
  thumbRow: { gap: 8, paddingTop: 10 },
  thumbWrap: { position: 'relative' },
  thumbImage: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 64,
    width: 64,
  },
  removeThumb: {
    alignItems: 'center',
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    top: -6,
    width: 20,
  },
  removeThumbText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  imageActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  imageButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13,
  },
  imageButtonText: { color: colors.text, fontWeight: '900' },
  detailRow: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    padding: 13,
  },
  detailLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  detailValue: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 3 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  cancelButtonText: { color: colors.text, fontWeight: '800' },
  saveButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, flex: 1, paddingVertical: 14 },
  saveButtonText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.5 },
});
