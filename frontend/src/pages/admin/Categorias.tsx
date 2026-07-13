import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Tags, X } from "lucide-react";
import CategoryModal from "../../components/categories/CategoryModal";
import { CategoryTable } from "../../components/categories/CategoryTable";
import { Category } from "../../types";
import { deleteCategory, fetchCategories } from "../../services/catalog";
import { getErrorMessage } from "../../utils/errors";

export default function Categorias() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      setCategories(await fetchCategories());
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudieron cargar las categorias."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCategories();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredCategories = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return categories;
    return categories.filter((category) => category.nombre.toLowerCase().includes(search));
  }, [categories, searchTerm]);

  const handleNew = () => {
    setMessage(null);
    setError(null);
    setSelectedCategory(null);
    setModalOpen(true);
  };

  const handleEdit = (category: Category) => {
    setMessage(null);
    setError(null);
    setSelectedCategory(category);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await deleteCategory(categoryToDelete.id);
      setCategories((current) => current.filter((category) => category.id !== categoryToDelete.id));
      setMessage("Categoria eliminada correctamente.");
      setCategoryToDelete(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo eliminar la categoria."));
    } finally {
      setDeleting(false);
    }
  };

  const handleModalSuccess = () => {
    setMessage(selectedCategory ? "Categoria actualizada correctamente." : "Categoria creada correctamente.");
    void loadCategories();
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Tags className="h-6 w-6 text-primary" />
            Gestion de Categorias
          </h2>
          <p className="mt-1 text-sm text-gray-400">Organiza las categorias que se usan en productos e inventario.</p>
        </div>

        <div className="flex w-full gap-3 sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar categoria..."
              className="premium-input py-2 pl-10 text-sm"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <button onClick={handleNew} className="btn-primary flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm">
            <Plus size={18} />
            Nueva Categoria
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-green-200">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-panel p-6 text-white">Cargando categorias...</div>
      ) : (
        <CategoryTable
          categories={filteredCategories}
          onEdit={handleEdit}
          onDelete={(id) => {
            const category = categories.find((item) => item.id === id);
            if (category) setCategoryToDelete(category);
          }}
        />
      )}

      <CategoryModal
        isOpen={modalOpen}
        initialData={selectedCategory}
        onClose={() => {
          setModalOpen(false);
          setSelectedCategory(null);
        }}
        onSuccess={handleModalSuccess}
      />

      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={deleting ? undefined : () => setCategoryToDelete(null)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-700 bg-grafito-800 shadow-premium">
            <div className="flex items-start justify-between border-b border-gray-700 bg-grafito-900/70 p-5">
              <div>
                <h3 className="text-lg font-bold text-white">Eliminar categoria</h3>
                <p className="mt-1 text-sm text-gray-400">{categoryToDelete.nombre}</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-gray-400 hover:bg-grafito-700 hover:text-white"
                onClick={() => setCategoryToDelete(null)}
                disabled={deleting}
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 p-5">
              <p className="text-sm text-gray-300">
                Esta accion eliminara la categoria. Si tiene productos asociados, el servidor puede rechazar la eliminacion.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-700 bg-grafito-900/60 p-5">
              <button onClick={() => setCategoryToDelete(null)} disabled={deleting} className="btn-secondary py-2 disabled:opacity-60">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger px-5 py-2 disabled:opacity-60">
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
