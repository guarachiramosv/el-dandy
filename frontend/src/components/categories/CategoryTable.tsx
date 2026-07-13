import React from 'react';
import { LucideEdit, LucideTrash, Tags } from 'lucide-react';
import { motion } from 'framer-motion';
import { Category } from '../../types';

interface Props {
  categories: Category[];
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
}

export const CategoryTable: React.FC<Props> = ({ categories, onEdit, onDelete }) => {
  return (
    <div className="glass-panel overflow-hidden">
      <table className="min-w-full divide-y divide-gray-700 text-sm">
        <thead className="bg-grafito-900/70">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-200">Nombre</th>
            <th className="px-4 py-3 text-right font-medium text-gray-200">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {categories.map((cat) => (
            <motion.tr
              key={cat.id}
              whileHover={{ backgroundColor: 'rgba(55,65,81,0.7)' }}
              className="transition-colors"
            >
              <td className="px-4 py-3 text-gray-100">{cat.nombre}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(cat)}
                    className="rounded p-2 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                    title="Editar categoria"
                  >
                    <LucideEdit size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(cat.id)}
                    className="rounded p-2 text-red-400 hover:bg-red-600/40 hover:text-red-200"
                    title="Eliminar categoria"
                  >
                    <LucideTrash size={18} />
                  </button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>

      {categories.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-gray-500">
          <Tags size={32} className="text-gray-600" />
          <p>No hay categorias para mostrar.</p>
        </div>
      )}
    </div>
  );
};
