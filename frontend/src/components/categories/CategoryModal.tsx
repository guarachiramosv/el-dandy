import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { createCategory, updateCategory } from '../../services/catalog';
import { Category } from '../../types';
import { getErrorMessage } from '../../utils/errors';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Category | null;
};

export default function CategoryModal({ isOpen, onClose, onSuccess, initialData }: ModalProps) {
  const isEdit = !!initialData;
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNombre(isEdit && initialData ? initialData.nombre : '');
      setError(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isEdit, initialData, isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedNombre = nombre.trim();
    if (!trimmedNombre) return setError('El nombre es obligatorio.');

    setLoading(true);
    setError(null);
    try {
      if (isEdit && initialData) {
        await updateCategory(initialData.id, trimmedNombre);
      } else {
        await createCategory(trimmedNombre);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error inesperado'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md rounded-xl border border-gray-700 bg-grafito-900 p-6 shadow-xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 hover:bg-grafito-800 hover:text-white disabled:opacity-60"
              title="Cerrar"
            >
              <X size={20} />
            </button>

            <h2 className="mb-4 text-xl font-semibold text-white">
              {isEdit ? 'Editar Categoria' : 'Crear Categoria'}
            </h2>

            {error && (
              <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-gray-300">Nombre</span>
                <input
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  required
                  minLength={3}
                  maxLength={100}
                  className="premium-input"
                  autoFocus
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="btn-secondary py-2 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex items-center px-5 py-2 disabled:opacity-60"
                >
                  {loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
