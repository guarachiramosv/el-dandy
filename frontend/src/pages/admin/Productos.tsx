import { useEffect, useState } from "react";
import ProductTable from "../../components/admin/productos/ProductTable";
import ProductFilters from "../../components/admin/productos/ProductFilters";
import ProductModal, { ProductFormData } from "../../components/admin/productos/ProductModal";
import { Category, Product, ProductDeletionHistory, Sucursal } from "../../types";
import { useProducts } from "../../hooks/useProducts";
import {
  addProductStock,
  createProduct,
  deleteProduct,
  fetchProductDeletionHistory,
  updateProduct,
  restoreProduct,
  type ProductStatusFilter,
} from "../../services/products";
import { fetchCategories, fetchSucursales } from "../../services/catalog";
import { uploadProductImages } from "../../services/uploads";
import { getErrorMessage } from "../../utils/errors";
import { filterAndSortBySearch } from "../../utils/fuzzySearch";

const statusFilterOptions: Array<{ value: ProductStatusFilter | "deleted"; label: string }> = [
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
  { value: "all", label: "Todos" },
  { value: "deleted", label: "Historial eliminados" },
];

export default function Productos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT" | "VIEW">("CREATE");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSucursalId, setSelectedSucursalId] = useState("");
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockSucursalId, setStockSucursalId] = useState("");
  const [stockCantidad, setStockCantidad] = useState(1);
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionHistory, setDeletionHistory] = useState<ProductDeletionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [branchAction, setBranchAction] = useState<{
    product: Product;
    action: "VIEW" | "EDIT" | "DELETE";
    sucursalId: string;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [pendingSaveProduct, setPendingSaveProduct] = useState<ProductFormData | null>(null);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<{
    product: Product;
    sucursalId: string;
    motivo: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter | "deleted">('active');
  const productStatusFilter: ProductStatusFilter = statusFilter === "deleted" ? "active" : statusFilter;
  const { data: filteredFetchedProducts, loading: filteredLoading, error: filteredError } = useProducts(productStatusFilter);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProducts(filteredFetchedProducts);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filteredFetchedProducts]);

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [categoryData, sucursalData] = await Promise.all([
          fetchCategories(),
          fetchSucursales(),
        ]);
        setCategories(categoryData);
        setSucursales(sucursalData);
      } catch (err: unknown) {
        setSaveError(getErrorMessage(err));
      }
    };
    const timer = window.setTimeout(() => {
      void loadCatalogs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredProducts = filterAndSortBySearch(
    products,
    searchTerm,
    (product) => [
      { value: product.codigo, weight: 2 },
      { value: product.codigoRepuesto, weight: 1.9 },
      { value: product.descripcion, weight: 1.5 },
      { value: product.ubicacion, weight: 1.25 },
      { value: product.marca, weight: 1 },
      { value: product.categoria?.nombre, weight: 0.9 },
      { value: product.sucursal?.nombre, weight: 0.7 },
    ],
    (product) => product.descripcion,
  );

  const handleNew = () => {
    setSaveError(null);
    setModalMode("CREATE");
    setSelectedProduct(null);
    setModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    openBranchAction(product, "EDIT");
  };

  const handleView = (product: Product) => {
    openBranchAction(product, "VIEW");
  };

  const handleDeleteRequest = (product: Product) => {
    openBranchAction(product, "DELETE");
  };

  const getActionBranches = (product: Product) => {
    const branches = product.stockSucursales || [];
    if (branches.length > 0) return branches;
    return [{
      id: product.sucursalId,
      productoId: product.id,
      sucursalId: product.sucursalId,
      sucursal: product.sucursal,
      stock: product.stock,
      estado: product.estado,
      activo: product.activo,
    }];
  };

  const openBranchAction = (product: Product, action: "VIEW" | "EDIT" | "DELETE") => {
    setSaveError(null);
    const branches = getActionBranches(product);
    const firstActive = branches.find((branch) => branch.estado === "ACTIVO" || !branch.estado) || branches[0];
    if (action === "DELETE") setDeletionReason("");
    setBranchAction({ product, action, sucursalId: firstActive?.sucursalId || product.sucursalId });
  };

  const runBranchAction = async () => {
    if (!branchAction) return;
    const { product, action, sucursalId } = branchAction;
    const branch = getActionBranches(product).find((item) => item.sucursalId === sucursalId);
    const productForBranch = {
      ...product,
      sucursalId,
      sucursal: branch?.sucursal || product.sucursal,
      stock: branch?.stock ?? product.stock,
    };

    if (action === "VIEW" || action === "EDIT") {
      setSelectedProduct(productForBranch);
      setSelectedSucursalId(sucursalId);
      setModalMode(action);
      setModalOpen(true);
      setBranchAction(null);
      return;
    }

    if (deletionReason.trim().length < 3) {
      setSaveError("Escribe el motivo de eliminacion antes de continuar.");
      return;
    }

    setPendingDeleteAction({ product, sucursalId, motivo: deletionReason.trim() });
  };

  const confirmDeleteProduct = async () => {
    if (!pendingDeleteAction) return;
    const { product, sucursalId, motivo } = pendingDeleteAction;
    const branch = getActionBranches(product).find((item) => item.sucursalId === sucursalId);
    setSavingProduct(true);
    try {
      const updated = await deleteProduct(product.id, { sucursalId, motivo });
      if (statusFilter === "active" && updated.estado !== "ACTIVO") {
        setProducts(prev => prev.filter(p => p.id !== updated.id));
      } else {
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      }
      const branchName = branch?.sucursal?.nombre || "la sucursal";
      setSaveError(`Producto enviado al historial de eliminacion en ${branchName}. Las otras sucursales se mantienen.`);
      setBranchAction(null);
      setPendingDeleteAction(null);
      setDeletionReason("");
      if (statusFilter === "deleted") void loadDeletionHistory();
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleAddStockRequest = (product: Product) => {
    setSaveError(null);
    setStockProduct(product);
    setStockSucursalId(product.stockSucursales?.[0]?.sucursalId || product.sucursalId || sucursales[0]?.id || "");
    setStockCantidad(1);
  };

  const handleAddStock = async () => {
    if (!stockProduct) return;
    if (!stockSucursalId) return setSaveError("Selecciona una sucursal.");
    if (!Number.isFinite(stockCantidad) || stockCantidad <= 0) return setSaveError("La cantidad debe ser mayor a cero.");

    setSaveError(null);
    setSavingProduct(true);
    try {
      const updated = await addProductStock(stockProduct.id, {
        sucursalId: stockSucursalId,
        cantidad: stockCantidad,
        notas: `Ingreso manual desde Productos. Estante: ${stockProduct.ubicacion || "Sin ubicacion"}`,
      });
      setProducts(prev => prev.map(p => (p.id === updated.id ? updated : p)));
      setStockProduct(null);
      setSaveError("Stock agregado correctamente sin duplicar el producto.");
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleSaveProduct = (savedProduct: ProductFormData) => {
    setSaveError(null);
    setPendingSaveProduct(savedProduct);
  };

  const confirmSaveProduct = async () => {
    if (!pendingSaveProduct) return;
    setSaveError(null);
    setSavingProduct(true);
    try {
      const imageFiles = pendingSaveProduct.imageFiles;
      const productPayload: Partial<ProductFormData> = { ...pendingSaveProduct };
      delete productPayload.imageFiles;
      if (modalMode !== "CREATE") {
        delete productPayload.stock;
        delete productPayload.sucursalId;
      }
      const normalizedCode = pendingSaveProduct.codigo.trim().toLowerCase();
      const duplicatedProduct = products.find((product) =>
        product.codigo.trim().toLowerCase() === normalizedCode &&
        product.id !== selectedProduct?.id
      );
      if (duplicatedProduct) {
        throw new Error(`Ya existe el codigo ${pendingSaveProduct.codigo} como ${duplicatedProduct.descripcion}. Usa el boton + para agregar stock en otra sucursal.`);
      }
      if (modalMode === "CREATE") {
        const created = await createProduct(productPayload as Omit<Product, "id" | "createdAt" | "updatedAt">);
        const withImage = imageFiles?.length ? (await uploadProductImages(created.id, imageFiles)).product : created;
        setProducts(prev => [withImage, ...prev]);
      } else if (modalMode === "EDIT" && selectedProduct) {
        const updated = await updateProduct(selectedProduct.id, productPayload);
        const withImage = imageFiles?.length ? (await uploadProductImages(updated.id, imageFiles)).product : updated;
        setProducts(prev => prev.map(p => (p.id === withImage.id ? withImage : p)));
      }
      setPendingSaveProduct(null);
      setModalOpen(false);
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err));
      setPendingSaveProduct(null);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleRestore = async (product: Product) => {
    try {
      const restored = await restoreProduct(product.id);
      if (statusFilter === 'inactive' || statusFilter === 'discontinued') setProducts(prev => prev.filter(p => p.id !== restored.id));
      else setProducts(prev => prev.map(p => p.id === restored.id ? restored : p));
      setSaveError("Producto restaurado correctamente.");
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err));
    }
  };

  const loadDeletionHistory = async () => {
    setLoadingHistory(true);
    try {
      setDeletionHistory(await fetchProductDeletionHistory());
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err));
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStatusFilterChange = (nextStatus: ProductStatusFilter | "deleted") => {
    setStatusFilter(nextStatus);
    if (nextStatus === "deleted") void loadDeletionHistory();
  };

  if (filteredLoading) return <div className="p-6 text-white">Cargando productos...</div>;
  if (filteredError) return <div className="p-6 text-red-400">Error al cargar productos: {filteredError}</div>;

  return (
    <div className="flex flex-col h-full space-y-6">
      {saveError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">{saveError}</div>}
      <div className="no-print">
        <ProductFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onNewProduct={handleNew}
        />
      </div>
      <div className="no-print rounded-xl border border-white/10 bg-grafito-900/80 p-3 shadow-inner">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {statusFilterOptions.map((option) => {
            const isActive = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleStatusFilterChange(option.value)}
                className={`flex min-h-14 items-center justify-center rounded-lg px-4 text-center text-sm font-bold transition-colors ${
                  isActive
                    ? "bg-primary-gradient text-white shadow-lg shadow-primary/20"
                    : "border border-white/10 bg-grafito-800 text-gray-200 hover:border-primary/40 hover:bg-grafito-700 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="no-print flex flex-1 flex-col">
        {statusFilter === "deleted" ? (
          <DeletionHistoryTable items={deletionHistory} loading={loadingHistory} />
        ) : (
          <ProductTable
            products={filteredProducts}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onView={handleView}
            onAddStock={handleAddStockRequest}
            onRestore={handleRestore}
          />
        )}
      </div>

      <ProductModal
        isOpen={modalOpen}
        mode={modalMode}
        product={selectedProduct}
        selectedSucursalId={selectedSucursalId}
        categories={categories}
        sucursales={sucursales}
        onClose={() => {
          setModalOpen(false);
          setSelectedSucursalId("");
        }}
        onSave={handleSaveProduct}
        saving={savingProduct}
        error={saveError}
      />

      {stockProduct && (
        <AddStockModal
          product={stockProduct}
          sucursales={sucursales}
          sucursalId={stockSucursalId}
          cantidad={stockCantidad}
          saving={savingProduct}
          onSucursalChange={setStockSucursalId}
          onCantidadChange={setStockCantidad}
          onClose={() => setStockProduct(null)}
          onConfirm={handleAddStock}
        />
      )}

      {branchAction && (
        <BranchActionModal
          product={branchAction.product}
          action={branchAction.action}
          sucursalId={branchAction.sucursalId}
          saving={savingProduct}
          onSucursalChange={(sucursalId) => setBranchAction(current => current ? { ...current, sucursalId } : current)}
          motivo={deletionReason}
          onMotivoChange={setDeletionReason}
          onClose={() => setBranchAction(null)}
          onConfirm={runBranchAction}
        />
      )}

      {pendingSaveProduct && (
        <ConfirmProductActionModal
          title={modalMode === "CREATE" ? "Crear producto" : "Guardar cambios"}
          message={
            modalMode === "CREATE"
              ? `Deseas crear el producto "${pendingSaveProduct.descripcion}"?`
              : `Deseas guardar los cambios de "${pendingSaveProduct.descripcion}"?`
          }
          confirmLabel={modalMode === "CREATE" ? "Si, crear" : "Si, guardar"}
          saving={savingProduct}
          onCancel={() => setPendingSaveProduct(null)}
          onConfirm={confirmSaveProduct}
        />
      )}

      {pendingDeleteAction && (
        <ConfirmProductActionModal
          title="Eliminar producto"
          message={`Deseas enviar "${pendingDeleteAction.product.descripcion}" al historial de eliminacion? Esta accion no registrara venta y conservara el motivo indicado.`}
          confirmLabel="Si, eliminar"
          danger
          saving={savingProduct}
          onCancel={() => setPendingDeleteAction(null)}
          onConfirm={confirmDeleteProduct}
        />
      )}
    </div>
  );
}

function ConfirmProductActionModal({
  title,
  message,
  confirmLabel,
  danger = false,
  saving,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={saving ? undefined : onCancel} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium">
        <div className="border-b border-gray-700 bg-grafito-900/70 p-5">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm text-gray-400">Confirma la accion antes de continuar.</p>
        </div>
        <div className="space-y-5 p-5">
          <p className="text-gray-200">{message}</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button onClick={onCancel} disabled={saving} className="btn-secondary disabled:opacity-60">
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={saving}
              className={`${danger ? "btn-danger" : "btn-primary"} disabled:opacity-60`}
            >
              {saving ? "Procesando..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddStockModal({
  product,
  sucursales,
  sucursalId,
  cantidad,
  saving,
  onSucursalChange,
  onCantidadChange,
  onClose,
  onConfirm,
}: {
  product: Product;
  sucursales: Sucursal[];
  sucursalId: string;
  cantidad: number;
  saving: boolean;
  onSucursalChange: (value: string) => void;
  onCantidadChange: (value: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const branchStock = product.stockSucursales?.find((item) => item.sucursalId === sucursalId);
  const currentStock = branchStock?.stock || 0;
  const nextStock = currentStock + (Number.isFinite(cantidad) ? cantidad : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium">
        <div className="border-b border-gray-700 bg-grafito-900/70 p-5">
          <h3 className="text-xl font-bold text-white">Agregar stock</h3>
          <p className="mt-1 text-sm text-gray-400">{product.codigo} - {product.descripcion}</p>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-gray-700 bg-grafito-900/40 p-3">
            <p className="text-xs uppercase text-gray-500">Estante conservado</p>
            <p className="mt-1 font-semibold text-white">{product.ubicacion || "Sin ubicacion registrada"}</p>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-300">Sucursal</span>
            <select className="premium-input" value={sucursalId} onChange={(event) => onSucursalChange(event.target.value)}>
              {sucursales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-300">Cantidad a agregar</span>
            <input
              className="premium-input"
              type="number"
              min="1"
              step={product.unidadVenta === "METRO" ? "0.01" : "1"}
              value={cantidad}
              onChange={(event) => onCantidadChange(Number(event.target.value))}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-700 bg-grafito-900/40 p-3">
              <p className="text-xs uppercase text-gray-500">Stock actual</p>
              <p className="mt-1 text-lg font-bold text-white">{currentStock}</p>
            </div>
            <div className="rounded-lg border border-green-500/25 bg-green-500/10 p-3">
              <p className="text-xs uppercase text-green-300/80">Quedara</p>
              <p className="mt-1 text-lg font-bold text-green-200">{nextStock}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-700 bg-grafito-900/60 p-5">
          <button onClick={onClose} disabled={saving} className="btn-secondary disabled:opacity-60">Cancelar</button>
          <button onClick={onConfirm} disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? "Agregando..." : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BranchActionModal({
  product,
  action,
  sucursalId,
  motivo,
  saving,
  onSucursalChange,
  onMotivoChange,
  onClose,
  onConfirm,
}: {
  product: Product;
  action: "VIEW" | "EDIT" | "DELETE";
  sucursalId: string;
  motivo: string;
  saving: boolean;
  onSucursalChange: (value: string) => void;
  onMotivoChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const branches = product.stockSucursales?.length
    ? product.stockSucursales
    : [{
      id: product.sucursalId,
      productoId: product.id,
      sucursalId: product.sucursalId,
      sucursal: product.sucursal,
      stock: product.stock,
      estado: product.estado,
      activo: product.activo,
    }];

  const actionLabel = {
    VIEW: "ver",
    EDIT: "editar",
    DELETE: "eliminar",
  }[action];

  const confirmLabel = {
    VIEW: "Ver",
    EDIT: "Editar",
    DELETE: "Enviar al historial",
  }[action];

  const selectedBranch = branches.find((branch) => branch.sucursalId === sucursalId) || branches[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-700 bg-grafito-800 shadow-premium">
        <div className="border-b border-gray-700 bg-grafito-900/70 p-5">
          <h3 className="text-xl font-bold text-white">Elegir sucursal para {actionLabel}</h3>
          <p className="mt-1 text-sm text-gray-400">{product.codigo} - {product.descripcion}</p>
        </div>

        <div className="space-y-3 p-5">
          {branches.map((branch) => {
            const selected = branch.sucursalId === sucursalId;
            const branchStatus = branch.estado || "ACTIVO";
            return (
              <button
                type="button"
                key={branch.sucursalId}
                onClick={() => onSucursalChange(branch.sucursalId)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  selected ? "border-primary bg-primary/10" : "border-gray-700 bg-grafito-900/40 hover:border-gray-500"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{branch.sucursal?.nombre || "Sucursal"}</p>
                    <p className="mt-1 text-sm text-gray-400">Stock: {branch.stock} - Estado: {branchStatus}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-xs font-bold ${
                    branchStatus === "ACTIVO"
                      ? "border-green-500/30 bg-green-500/10 text-green-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  }`}>
                    {selected ? "Seleccionada" : branchStatus}
                  </span>
                </div>
              </button>
            );
          })}

          {selectedBranch && (
            <div className="rounded-lg border border-gray-700 bg-grafito-900/40 p-3">
              <p className="text-xs uppercase text-gray-500">Estante conservado</p>
              <p className="mt-1 font-semibold text-white">{product.ubicacion || "Sin ubicacion registrada"}</p>
            </div>
          )}

          {action === "DELETE" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-300">Motivo de eliminacion</span>
              <textarea
                className="premium-input min-h-[110px] resize-y"
                value={motivo}
                onChange={(event) => onMotivoChange(event.target.value)}
                placeholder="Ej. Producto duplicado, error de registro, no corresponde a esta sucursal..."
              />
            </label>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-700 bg-grafito-900/60 p-5">
          <button onClick={onClose} disabled={saving} className="btn-secondary disabled:opacity-60">Cancelar</button>
          <button onClick={onConfirm} disabled={saving || !selectedBranch || (action === "DELETE" && motivo.trim().length < 3)} className="btn-primary disabled:opacity-60">
            {saving ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeletionHistoryTable({ items, loading }: { items: ProductDeletionHistory[]; loading: boolean }) {
  if (loading) {
    return <div className="glass-panel p-6 text-white">Cargando historial...</div>;
  }

  return (
    <div className="glass-panel overflow-hidden">
      <table className="w-full text-left">
        <thead className="border-b border-gray-700 bg-grafito-800/80 text-sm uppercase text-gray-400">
          <tr>
            <th className="p-4">Fecha / hora</th>
            <th className="p-4">Codigo</th>
            <th className="p-4">Producto</th>
            <th className="p-4">Sucursal</th>
            <th className="p-4">Stock</th>
            <th className="p-4">Usuario</th>
            <th className="p-4">Motivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-grafito-800/50">
              <td className="p-4 text-sm text-gray-300">{new Date(item.createdAt).toLocaleString("es-BO")}</td>
              <td className="p-4 font-mono text-sm text-gray-300">
                <span className="block">{item.producto?.codigo || "-"}</span>
                {item.producto?.codigoRepuesto && (
                  <span className="mt-1 block text-xs text-gray-500">Rep. {item.producto.codigoRepuesto}</span>
                )}
              </td>
              <td className="p-4">
                <p className="font-semibold text-white">{item.producto?.descripcion || "Producto"}</p>
                <p className="text-xs text-gray-500">{item.producto?.marca || ""}</p>
              </td>
              <td className="p-4 text-gray-300">{item.sucursal?.nombre || "Sin sucursal"}</td>
              <td className="p-4 text-gray-300">{item.stockAnterior}</td>
              <td className="p-4 text-gray-300">{item.usuario?.nombre || "Usuario"}</td>
              <td className="p-4 text-gray-300">{item.motivo}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <div className="p-12 text-center text-gray-500">
          No hay eliminaciones registradas.
        </div>
      )}
    </div>
  );
}
