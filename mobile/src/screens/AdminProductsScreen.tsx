import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  createProduct,
  deleteProduct,
  getAdminProducts,
  getCategories,
  getSucursales,
  updateProduct,
  uploadProductImage,
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
  codigoRepuesto: string;
  descripcion: string;
  marca: string;
  condicion: 'NUEVO' | 'USADO';
  unidadVenta: 'UNIDAD' | 'METRO';
  stock: string;
  stockMinimo: string;
  ubicacion: string;
  precioCompra: string;
  precioVenta: string;
  categoriaId: string;
  sucursalId: string;
  imagen: string;
  deletedImageUrls: string[];
};

const emptyForm: FormState = {
  codigo: '',
  codigoRepuesto: '',
  descripcion: '',
  marca: '',
  condicion: 'NUEVO',
  unidadVenta: 'UNIDAD',
  stock: '0',
  stockMinimo: '5',
  ubicacion: '',
  precioCompra: '',
  precioVenta: '',
  categoriaId: '',
  sucursalId: '',
  imagen: '',
  deletedImageUrls: [],
};

const statusOptions: Array<{ value: ProductStatusFilter; label: string }> = [
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'discontinued', label: 'Descontinuados' },
  { value: 'all', label: 'Todos' },
];

const maxProductImages = 20;
const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

const apiOrigin = process.env.EXPO_PUBLIC_API_URL
  ? process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '')
  : 'http://192.168.0.4:4000';

function money(value?: number) {
  return `Bs ${(value || 0).toFixed(2)}`;
}

function productToForm(product: Product): FormState {
  return {
    codigo: product.codigo,
    codigoRepuesto: product.codigoRepuesto || '',
    descripcion: product.descripcion,
    marca: product.marca || '',
    condicion: product.condicion === 'USADO' ? 'USADO' : 'NUEVO',
    unidadVenta: product.unidadVenta === 'METRO' ? 'METRO' : 'UNIDAD',
    stock: String(product.stock ?? 0),
    stockMinimo: String(product.stockMinimo ?? 5),
    ubicacion: product.ubicacion || '',
    precioCompra: String(product.precioCompra ?? ''),
    precioVenta: String(product.precioVenta ?? ''),
    categoriaId: product.categoriaId || product.categoria?.id || '',
    sucursalId: product.sucursalId || product.sucursal?.id || '',
    imagen: product.imagen || '',
    deletedImageUrls: [],
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
  const safeName = ['jpg', 'jpeg', 'png', 'webp'].includes(extension || '')
    ? name
    : `${name.replace(/\.[^/.]+$/, '') || 'producto'}.jpg`;
  const fallbackType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  const type = asset.mimeType && acceptedImageTypes.includes(asset.mimeType) ? asset.mimeType : fallbackType;
  return {
    uri: asset.uri,
    name: safeName,
    type,
  };
}

function formToInput(form: FormState): ProductInput {
  return {
    codigo: form.codigo.trim() || null,
    codigoRepuesto: form.codigoRepuesto.trim() || null,
    descripcion: form.descripcion.trim(),
    marca: form.marca.trim() || null,
    condicion: form.condicion,
    unidadVenta: form.unidadVenta,
    stock: Number(form.stock.replace(',', '.')),
    stockMinimo: Number(form.stockMinimo.replace(',', '.')),
    ubicacion: form.ubicacion.trim() || null,
    precioCompra: Number(form.precioCompra.replace(',', '.')),
    precioVenta: Number(form.precioVenta.replace(',', '.')),
    categoriaId: form.categoriaId,
    sucursalId: form.sucursalId,
    imagen: form.imagen.trim() || null,
    deletedImageUrls: form.deletedImageUrls,
  };
}

async function uploadImagesWithFallback(
  token: string,
  productId: string,
  images: ProductImageUpload[],
) {
  try {
    const upload = await uploadProductImages(token, productId, images);
    return upload.product;
  } catch (multiUploadError) {
    let product: Product | null = null;
    for (const image of images) {
      const upload = await uploadProductImage(token, productId, image);
      product = upload.product;
    }
    return product;
  }
}

export default function AdminProductsScreen({ session }: { session: Session }) {
  const { width } = useWindowDimensions();
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

  const existingImages = useMemo(() => {
    const urls = productImageUrls(editingProduct);
    return urls.filter(url => !form.deletedImageUrls.includes(url));
  }, [editingProduct, form.deletedImageUrls]);
  const primaryFallbackImage = form.deletedImageUrls.includes(form.imagen) ? '' : form.imagen;
  const primaryImageUrl = productImageUrl(existingImages[0] || primaryFallbackImage);

  const token = session.token;
  const compactLayout = width < 380;

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

  const catalogWarning = !formReady
    ? 'Para guardar productos necesitas al menos una categoria y una sucursal cargadas.'
    : '';

  const openCreate = () => {
    setEditingProduct(null);
    setSelectedImages([]);
    setError('');
    if (!formReady) {
      loadCatalogs().catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar categorias o sucursales.');
      });
    }
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
    setError('');
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
    if (!input.descripcion) {
      return 'Descripcion es requerida.';
    }
    if (!input.categoriaId || !input.sucursalId) {
      return 'Selecciona categoria y sucursal.';
    }
    if (!Number.isFinite(input.stock) || input.stock < 0) {
      return 'Stock debe ser un numero mayor o igual a 0.';
    }
    if (input.unidadVenta !== 'METRO' && !Number.isInteger(input.stock)) {
      return 'Stock por unidad debe ser entero. Para decimales elige venta por metro.';
    }
    if (!Number.isFinite(input.stockMinimo) || input.stockMinimo < 0) {
      return 'Stock minimo debe ser un numero mayor o igual a 0.';
    }
    if (input.unidadVenta !== 'METRO' && !Number.isInteger(input.stockMinimo)) {
      return 'Stock minimo por unidad debe ser entero. Para decimales elige venta por metro.';
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
            selectionLimit: maxProductImages,
          });

    if (!result.canceled) {
      setSelectedImages((current) => {
        const nextImages = [...current, ...result.assets];
        if (nextImages.length > maxProductImages) {
          setError(`Puedes subir hasta ${maxProductImages} fotos por producto.`);
        }
        return nextImages.slice(0, maxProductImages);
      });
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
      let uploadError = '';

      if (selectedImages.length > 0) {
        try {
          saved = await uploadImagesWithFallback(token, saved.id, selectedImages.map(uploadFromAsset)) || saved;
        } catch (err) {
          uploadError = err instanceof Error ? err.message : 'No se pudieron subir las fotos.';
        }
      }

      setProducts((current) => {
        if (editingProduct) return current.map((item) => (item.id === saved.id ? saved : item));
        return [saved, ...current];
      });
      setModalOpen(false);
      setEditingProduct(null);
      setSelectedImages([]);
      if (uploadError) {
        Alert.alert(
          'Producto guardado',
          `El producto se guardo correctamente, pero no se pudieron subir las fotos. ${uploadError}`,
        );
      }
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
            const updated = await deleteProduct(token, product.id, {
              sucursalId: product.sucursalId || null,
              motivo: 'Eliminado desde la app movil',
            });
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
          <View style={styles.codeStack}>
            <View style={styles.codeBadge}>
              <Text style={styles.code}>{item.codigo}</Text>
            </View>
            {!!item.codigoRepuesto && <Text style={styles.spareCode}>Rep. {item.codigoRepuesto}</Text>}
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
              <Text style={styles.listImageFallbackText}>{(item.marca || item.descripcion || 'PR').slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.productSummaryText}>
            <Text style={styles.productName}>{item.descripcion}</Text>
            <Text style={styles.meta}>
              {item.marca || 'Sin marca'} - {item.condicion} - {item.unidadVenta === 'METRO' ? 'Por metro' : 'Por unidad'} - {item.categoria?.nombre || 'Sin categoria'}
            </Text>
            <View style={styles.cardBottom}>
              <Text style={styles.branch}>{item.sucursal?.nombre || 'Sucursal'}</Text>
              <Text style={styles.price}>{money(item.precioVenta)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.stockRow}>
          <Text style={[styles.stock, lowStock && styles.stockLow]}>
            Stock {item.stock} {item.unidadVenta === 'METRO' ? 'm' : 'u'} / min. {item.stockMinimo}
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
      <View style={[styles.titleRow, compactLayout && styles.titleRowCompact]}>
        <View style={[styles.titleTextWrap, compactLayout && styles.titleTextWrapCompact]}>
          <Text style={styles.heading}>Productos</Text>
          <Text style={styles.caption}>Vista admin para consulta y CRUD.</Text>
        </View>
        <Pressable onPress={openCreate} style={[styles.newButton, compactLayout && styles.newButtonCompact]}>
          <Text style={styles.newButtonText}>Nuevo</Text>
        </Pressable>
      </View>

      <View style={[styles.searchRow, compactLayout && styles.searchRowCompact]}>
        <TextInput
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          placeholder="Codigo, repuesto 2, descripcion o marca"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={[styles.input, compactLayout && styles.inputCompact]}
          value={search}
        />
        <Pressable onPress={submitSearch} style={[styles.searchButton, compactLayout && styles.searchButtonCompact]}>
          <Text style={styles.searchButtonText}>Buscar</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        style={styles.statusTabsScroll}
        contentContainerStyle={styles.statusTabs}
        showsHorizontalScrollIndicator={false}
      >
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

      {!!catalogWarning && <Text style={styles.warning}>{catalogWarning}</Text>}
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
                loadCatalogs().catch((err) => {
                  setError(err instanceof Error ? err.message : 'No se pudo cargar categorias o sucursales.');
                });
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingProduct ? 'Editar producto' : 'Nuevo producto'}</Text>
              {!formReady && <Text style={styles.modalWarning}>{catalogWarning}</Text>}
              <Text style={styles.fieldLabel}>Imagen del Repuesto</Text>
              <View style={styles.imageBox}>
                {selectedImages[0]?.uri ? (
                  <Pressable onPress={() => setViewerImage(selectedImages[0].uri)} style={styles.previewPressable}>
                    <Image source={{ uri: selectedImages[0].uri }} style={styles.previewImage} />
                  </Pressable>
                ) : primaryImageUrl ? (
                  <Pressable onPress={() => setViewerImage(primaryImageUrl)} style={styles.previewPressable}>
                    <Image source={{ uri: primaryImageUrl }} style={styles.previewImage} />
                  </Pressable>
                ) : (
                  <View style={styles.previewFallback}>
                    <Text style={styles.previewFallbackText}>Sin imagen</Text>
                  </View>
                )}
              </View>
              {(existingImages.length > 0 || selectedImages.length > 0) && (
                <ScrollView horizontal contentContainerStyle={styles.thumbRow} showsHorizontalScrollIndicator={false}>
                  {existingImages.map((image, index) => (
                    <View key={`${image}-${index}`} style={styles.thumbWrap}>
                      <Pressable onPress={() => setViewerImage(productImageUrl(image)!)}>
                        <Image source={{ uri: productImageUrl(image)! }} style={styles.thumbImage} />
                      </Pressable>
                      <Pressable onPress={() => setForm(current => ({ ...current, deletedImageUrls: [...current.deletedImageUrls, image] }))} style={styles.removeThumb}>
                        <Text style={styles.removeThumbText}>x</Text>
                      </Pressable>
                    </View>
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
              <Text style={styles.imageHint}>
                {selectedImages.length > 0
                  ? `${selectedImages.length} foto${selectedImages.length === 1 ? '' : 's'} nueva${selectedImages.length === 1 ? '' : 's'} seleccionada${selectedImages.length === 1 ? '' : 's'}`
                  : `Puedes subir hasta ${maxProductImages} fotos.`}
              </Text>
              <View style={styles.imageActions}>
                <Pressable disabled={saving || selectedImages.length >= maxProductImages} onPress={() => pickImage('camera')} style={styles.imageButton}>
                  <Text style={styles.imageButtonText}>Tomar foto</Text>
                </Pressable>
                <Pressable disabled={saving || selectedImages.length >= maxProductImages} onPress={() => pickImage('library')} style={styles.imageButton}>
                  <Text style={styles.imageButtonText}>Galeria / archivos</Text>
                </Pressable>
              </View>

              <Field label="Codigo interno" value={editingProduct ? form.codigo : 'Automatico'} onChangeText={() => {}} editable={false} />
              <Field label="Codigo repuesto 2" value={form.codigoRepuesto} onChangeText={(value) => setForm((current) => ({ ...current, codigoRepuesto: value }))} />
              <Field label="Descripcion" value={form.descripcion} onChangeText={(value) => setForm((current) => ({ ...current, descripcion: value }))} />

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

              <Field label="Marca opcional" value={form.marca} onChangeText={(value) => setForm((current) => ({ ...current, marca: value }))} />

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

              <Text style={styles.fieldLabel}>Unidad de venta</Text>
              <View style={styles.toggleRow}>
                {([
                  { value: 'UNIDAD' as const, label: 'Por unidad' },
                  { value: 'METRO' as const, label: 'Por metro' },
                ]).map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setForm((current) => ({ ...current, unidadVenta: option.value }))}
                    style={[styles.toggleButton, form.unidadVenta === option.value && styles.toggleButtonActive]}
                  >
                    <Text style={[styles.toggleText, form.unidadVenta === option.value && styles.toggleTextActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Sucursal inicial</Text>
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

              <Field label="Ubicacion / Estante" value={form.ubicacion} onChangeText={(value) => setForm((current) => ({ ...current, ubicacion: value }))} />
              <Field label={`${editingProduct ? 'Stock Total' : 'Stock Inicial'} ${form.unidadVenta === 'METRO' ? '(metros)' : '(unidades)'}`} keyboardType={form.unidadVenta === 'METRO' ? 'decimal-pad' : 'number-pad'} value={form.stock} onChangeText={(value) => setForm((current) => ({ ...current, stock: value }))} />
              <Field label={`Stock Minimo ${form.unidadVenta === 'METRO' ? '(metros)' : '(unidades)'}`} keyboardType={form.unidadVenta === 'METRO' ? 'decimal-pad' : 'number-pad'} value={form.stockMinimo} onChangeText={(value) => setForm((current) => ({ ...current, stockMinimo: value }))} />
              <Field label="Precio de Compra" keyboardType="decimal-pad" value={form.precioCompra} onChangeText={(value) => setForm((current) => ({ ...current, precioCompra: value }))} />
              <Field label="Precio de Venta" keyboardType="decimal-pad" value={form.precioVenta} onChangeText={(value) => setForm((current) => ({ ...current, precioVenta: value }))} />

              <View style={styles.modalActions}>
                <Pressable disabled={saving} onPress={() => setModalOpen(false)} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable disabled={saving || !formReady} onPress={saveProduct} style={[styles.saveButton, (saving || !formReady) && styles.disabled]}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar</Text>}
                </Pressable>
              </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
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
                  <Detail label="Codigo repuesto 2" value={viewProduct.codigoRepuesto || 'Sin codigo'} />
                  <Detail label="Descripcion" value={viewProduct.descripcion} />
                  <Detail label="Marca" value={viewProduct.marca || 'Sin marca'} />
                  <Detail label="Condicion" value={viewProduct.condicion} />
                  <Detail label="Unidad de venta" value={viewProduct.unidadVenta === 'METRO' ? 'Por metro' : 'Por unidad'} />
                  <Detail label="Ubicacion / Estante" value={viewProduct.ubicacion || 'Sin ubicacion'} />
                  <Detail label="Stock" value={`${viewProduct.stock} ${viewProduct.unidadVenta === 'METRO' ? 'metros' : 'unidades'}`} />
                  <Detail label="Stock minimo" value={`${viewProduct.stockMinimo} ${viewProduct.unidadVenta === 'METRO' ? 'metros' : 'unidades'}`} />
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
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  editable?: boolean;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        editable={editable}
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
  titleRowCompact: { alignItems: 'stretch', flexDirection: 'column' },
  titleTextWrap: { flex: 1 },
  titleTextWrapCompact: { flex: 0 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  caption: { color: colors.muted, marginTop: 4 },
  newButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  newButtonCompact: { marginTop: 10 },
  newButtonText: { color: '#fff', fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  searchRowCompact: { flexDirection: 'column' },
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
  inputCompact: { flex: 0 },
  searchButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  searchButtonCompact: { width: '100%' },
  searchButtonText: { color: '#fff', fontWeight: '800' },
  statusTabsScroll: { flexGrow: 0, maxHeight: 58 },
  statusTabs: { alignItems: 'center', gap: 8, paddingBottom: 8, paddingTop: 12 },
  statusTab: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  statusTabActive: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderColor: colors.primary },
  statusTabText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  statusTabTextActive: { color: colors.primaryLight },
  loader: { marginTop: 50 },
  error: { color: '#FCA5A5', marginTop: 10 },
  warning: { color: '#FBBF24', fontSize: 13, marginTop: 10 },
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
  codeStack: { alignItems: 'flex-start', flex: 1, gap: 4, paddingRight: 8 },
  codeBadge: { backgroundColor: 'rgba(249, 115, 22, 0.16)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  code: { color: colors.primaryLight, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontWeight: '800' },
  spareCode: { color: colors.muted, fontSize: 12, fontWeight: '800' },
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
  modalKeyboard: { flex: 1, justifyContent: 'flex-end', width: '100%' },
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
  modalWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 12,
    borderWidth: 1,
    color: '#FCD34D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    padding: 12,
  },
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
  imageHint: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 8 },
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
