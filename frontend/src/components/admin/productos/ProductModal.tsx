import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ImagePlus, Save, Truck, X } from "lucide-react";
import ImageLightbox from "../../ImageLightbox";
import type { Category, Product, Sucursal } from "../../../types";
import { productImageUrl } from "../../../utils/images";

type ProductFormData = {
  id?: string;
  codigo: string;
  codigoRepuesto?: string | null;
  descripcion: string;
  categoriaId: string;
  marca: string;
  condicion: "NUEVO" | "USADO";
  unidadVenta: "UNIDAD" | "METRO";
  stock: number;
  stockMinimo?: number;
  ubicacion?: string | null;
  precioCompra: number;
  precioVenta: number;
  sucursalId: string;
  imagen?: string;
  imageFiles?: File[];
  deletedImageUrls?: string[];
};

interface ProductModalProps {
  isOpen: boolean;
  mode: "CREATE" | "EDIT" | "VIEW";
  product?: Product | null;
  selectedSucursalId?: string;
  categories: Category[];
  sucursales: Sucursal[];
  onClose: () => void;
  onSave: (product: ProductFormData) => void;
  saving?: boolean;
  error?: string | null;
}

const buildInitialFormData = (
  product: Product | null | undefined,
  mode: ProductModalProps["mode"],
  categories: Category[],
  sucursales: Sucursal[],
): ProductFormData => {
  const defaultCategoryId = categories[0]?.id || "";
  const defaultSucursalId = sucursales[0]?.id || "";

  if (product && (mode === "EDIT" || mode === "VIEW")) {
    return {
      id: product.id,
      codigo: product.codigo,
      codigoRepuesto: product.codigoRepuesto || "",
      descripcion: product.descripcion,
      categoriaId: product.categoriaId,
      marca: product.marca,
      condicion: product.condicion === "USADO" ? "USADO" : "NUEVO",
      unidadVenta: product.unidadVenta === "METRO" ? "METRO" : "UNIDAD",
      stock: product.stock,
      stockMinimo: product.stockMinimo || 5,
      ubicacion: product.ubicacion || "",
      precioCompra: product.precioCompra,
      precioVenta: product.precioVenta,
      sucursalId: product.sucursalId,
      imagen: product.imagen,
      imageFiles: [],
      deletedImageUrls: [],
    };
  }

  return {
    codigo: "",
    codigoRepuesto: "",
    descripcion: "",
    categoriaId: defaultCategoryId,
    marca: "Universal",
    condicion: "NUEVO",
    unidadVenta: "UNIDAD",
    stock: 0,
    stockMinimo: 5,
    ubicacion: "",
    precioCompra: 0,
    precioVenta: 0,
    sucursalId: defaultSucursalId,
    imagen: undefined,
    imageFiles: [],
    deletedImageUrls: [],
  };
};

type ProductModalContentProps = Omit<ProductModalProps, "isOpen">;

export default function ProductModal({ isOpen, ...contentProps }: ProductModalProps) {
  if (!isOpen) return null;

  const modalKey = [
    contentProps.mode,
    contentProps.product?.id ?? "new",
    contentProps.product?.updatedAt ?? "",
    contentProps.categories[0]?.id ?? "no-category",
    contentProps.sucursales[0]?.id ?? "no-sucursal",
  ].join("|");

  return <ProductModalContent key={modalKey} {...contentProps} />;
}

function ProductModalContent({
  mode,
  product,
  selectedSucursalId,
  categories,
  sucursales,
  onClose,
  onSave,
  saving = false,
  error,
}: ProductModalContentProps) {
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(() =>
    buildInitialFormData(product, mode, categories, sucursales)
  );

  const selectedPreviewUrls = useMemo(
    () => (formData.imageFiles || []).map((file) => URL.createObjectURL(file)),
    [formData.imageFiles]
  );

  const existingImageUrls = useMemo(() => {
    const gallery = product?.imagenes?.map((image) => image.url).filter(Boolean) || [];
    if (gallery.length > 0) return gallery.filter(url => !formData.deletedImageUrls?.includes(url));
    if (formData.imagen && !formData.deletedImageUrls?.includes(formData.imagen)) return [formData.imagen];
    return [];
  }, [formData.imagen, product?.imagenes, formData.deletedImageUrls]);

  useEffect(() => {
    return () => selectedPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [selectedPreviewUrls]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormError(null);
    setFormData(prev => ({
      ...prev,
      [name]: name === "stock" || name === "stockMinimo" || name === "precioCompra" || name === "precioVenta" ? Number(value) : value,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setFormData(prev => ({ ...prev, imageFiles: [...(prev.imageFiles || []), ...selectedFiles] }));
    }
    e.target.value = "";
  };

  const removeSelectedImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      imageFiles: (prev.imageFiles || []).filter((_, fileIndex) => fileIndex !== index),
    }));
  };

  const removeExistingImage = (url: string) => {
    setFormData(prev => ({
      ...prev,
      deletedImageUrls: [...(prev.deletedImageUrls || []), url],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "VIEW") {
      onClose();
      return;
    }

    const payload = {
      ...formData,
      codigo: formData.codigo.trim(),
      codigoRepuesto: formData.codigoRepuesto?.trim() || null,
      descripcion: formData.descripcion.trim(),
      marca: formData.marca.trim(),
      ubicacion: formData.ubicacion?.trim() || null,
    };

    if (!payload.descripcion) return setFormError("La descripcion es obligatoria.");
    if (!payload.marca) return setFormError("La marca es obligatoria.");
    if (!payload.categoriaId) return setFormError("Selecciona una categoria.");
    if (!payload.sucursalId) return setFormError("Selecciona una sucursal.");
    if (payload.precioCompra <= 0) return setFormError("El precio de compra debe ser mayor a 0.");
    if (payload.precioVenta <= 0) return setFormError("El precio de venta debe ser mayor a 0.");

    onSave(payload);
  };

  const isReadOnly = mode === "VIEW";
  const isCreateMode = mode === "CREATE";
  const selectedBranch = product?.stockSucursales?.find((item) => item.sucursalId === selectedSucursalId);
  const selectedBranchName = selectedBranch?.sucursal?.nombre || product?.sucursal?.nombre || "Sucursal seleccionada";
  const primaryPreviewImage = selectedPreviewUrls[0] || productImageUrl(existingImageUrls[0]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-3xl bg-grafito-800 border border-gray-700 rounded-2xl shadow-premium overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-700 bg-grafito-900/50">
            <h3 className="text-xl font-bold text-white">
              {mode === "CREATE" && "Nuevo Producto"}
              {mode === "EDIT" && "Editar Producto"}
              {mode === "VIEW" && "Detalle de Producto"}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            <form id="product-form" onSubmit={handleSubmit} noValidate className="space-y-6">
              {(formError || error) && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-200">
                  {formError || error}
                </div>
              )}
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">Imagen del Repuesto</label>
                  <div className="aspect-square bg-grafito-900/50 border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center text-gray-400 overflow-hidden">
                    {primaryPreviewImage ? (
                      <button
                        type="button"
                        onClick={() => setLightboxImage({ url: primaryPreviewImage, alt: formData.descripcion || "Producto" })}
                        className="h-full w-full"
                      >
                        <img src={primaryPreviewImage} alt="Preview producto" className="w-full h-full object-cover" />
                      </button>
                    ) : <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-grafito-900 to-grafito-700"><Truck size={36} className="mb-2 text-primary" /><span className="text-sm">Sin imagen</span></div>}
                  </div>
                  {(existingImageUrls.length > 0 || selectedPreviewUrls.length > 0) && (
                    <div className="grid grid-cols-3 gap-2">
                      {existingImageUrls.map((image, index) => (
                        <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-lg border border-gray-700 bg-grafito-900">
                          <button
                            type="button"
                            onClick={() => setLightboxImage({ url: productImageUrl(image)!, alt: `Foto guardada ${index + 1}` })}
                            className="h-full w-full"
                          >
                            <img src={productImageUrl(image)!} alt={`Foto guardada ${index + 1}`} className="h-full w-full object-cover" />
                          </button>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => removeExistingImage(image)}
                              className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-accent"
                              title="Quitar foto"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      {selectedPreviewUrls.map((url, index) => (
                        <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-primary/50 bg-grafito-900">
                          <button
                            type="button"
                            onClick={() => setLightboxImage({ url, alt: `Foto nueva ${index + 1}` })}
                            className="h-full w-full"
                          >
                            <img src={url} alt={`Foto nueva ${index + 1}`} className="h-full w-full object-cover" />
                          </button>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => removeSelectedImage(index)}
                              className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-accent"
                              title="Quitar foto"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!isReadOnly && (
                    <div className="grid grid-cols-1 gap-2">
                      <label className="btn-secondary flex items-center justify-center gap-2 text-center cursor-pointer">
                        <Camera size={18} />
                        <span>Tomar foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </label>
                      <label className="btn-secondary flex items-center justify-center gap-2 text-center cursor-pointer">
                        <ImagePlus size={18} />
                        <span>Galeria / archivos</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Codigo interno</label>
                    <input type="text" name="codigo" value={isCreateMode ? "Automatico" : formData.codigo} onChange={handleChange} readOnly className="premium-input" placeholder="Automatico" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Codigo repuesto 2</label>
                    <input type="text" name="codigoRepuesto" value={formData.codigoRepuesto || ""} onChange={handleChange} readOnly={isReadOnly} className="premium-input" placeholder="Ej. ALT-001" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-sm font-medium text-gray-300">Descripcion</label>
                    <input required type="text" name="descripcion" value={formData.descripcion} onChange={handleChange} readOnly={isReadOnly} className="premium-input" placeholder="Descripcion completa" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Categoria</label>
                    <select name="categoriaId" value={formData.categoriaId} onChange={handleChange} disabled={isReadOnly} className="premium-input">
                      {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Marca</label>
                    <input required type="text" name="marca" value={formData.marca} onChange={handleChange} readOnly={isReadOnly} className="premium-input" placeholder="Mercedes Benz, Volvo, Scania..." />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Condicion</label>
                    <select name="condicion" value={formData.condicion} onChange={handleChange} disabled={isReadOnly} className="premium-input">
                      <option value="NUEVO">Nuevo</option>
                      <option value="USADO">Usado</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Unidad de venta</label>
                    <select name="unidadVenta" value={formData.unidadVenta} onChange={handleChange} disabled={isReadOnly} className="premium-input">
                      <option value="UNIDAD">Por unidad</option>
                      <option value="METRO">Por metro</option>
                    </select>
                  </div>
                  {isCreateMode && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-300">Sucursal inicial</label>
                      <select name="sucursalId" value={formData.sucursalId} onChange={handleChange} className="premium-input">
                        {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-sm font-medium text-gray-300">Ubicacion / Estante</label>
                    <input type="text" name="ubicacion" value={formData.ubicacion || ""} onChange={handleChange} readOnly={isReadOnly} className="premium-input" placeholder="Ej. Estante A3, Pasillo 2" />
                  </div>
                </div>
              </div>

              <hr className="border-gray-700" />

              {selectedBranch && (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                  <p className="text-xs uppercase text-primary-light">Sucursal seleccionada</p>
                  <p className="mt-1 font-semibold text-white">
                    {selectedBranch.sucursal?.nombre || "Sucursal"} - Stock {selectedBranch.stock} - {selectedBranch.estado || "ACTIVO"}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">
                    {isCreateMode ? "Stock Inicial" : `Stock ${selectedBranchName}`} {formData.unidadVenta === "METRO" ? "(m)" : ""}
                  </label>
                  <input required type="number" min="0" step={formData.unidadVenta === "METRO" ? "0.01" : "1"} name="stock" value={formData.stock} onChange={handleChange} readOnly={isReadOnly} className="premium-input" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Stock Minimo</label>
                  <input required type="number" min="0" step={formData.unidadVenta === "METRO" ? "0.01" : "1"} name="stockMinimo" value={formData.stockMinimo || 0} onChange={handleChange} readOnly={isReadOnly} className="premium-input" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Precio de Compra</label>
                  <input required type="number" min="0" step="0.01" name="precioCompra" value={formData.precioCompra} onChange={handleChange} readOnly={isReadOnly} className="premium-input" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Precio de Venta</label>
                  <input required type="number" min="0" step="0.01" name="precioVenta" value={formData.precioVenta} onChange={handleChange} readOnly={isReadOnly} className="premium-input" />
                </div>
              </div>

              {(product?.stockSucursales?.length || 0) > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Stock por sucursal</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {product?.stockSucursales?.map((item) => (
                      <div key={item.id} className="rounded-lg border border-gray-700 bg-grafito-900/40 p-3">
                        <p className="text-xs uppercase text-gray-500">{item.sucursal?.nombre || "Sucursal"}</p>
                        <p className="mt-1 text-lg font-bold text-white">{item.stock} {formData.unidadVenta === "METRO" ? "m" : "unidades"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>

          <div className="p-6 border-t border-gray-700 bg-grafito-900/50 flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">
              {mode === "VIEW" ? "Cerrar" : "Cancelar"}
            </button>
            {mode !== "VIEW" && (
              <button type="submit" form="product-form" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                <Save size={18} /> {saving ? "Guardando imagenes..." : "Guardar"}
              </button>
            )}
          </div>
        </motion.div>
        <ImageLightbox imageUrl={lightboxImage?.url || null} alt={lightboxImage?.alt} onClose={() => setLightboxImage(null)} />
      </div>
    </AnimatePresence>
  );
}

export type { ProductFormData };
