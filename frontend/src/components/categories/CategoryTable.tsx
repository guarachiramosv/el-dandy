import React from 'react';
import { LucideEdit, LucideTrash } from 'lucide-react';
import { Category } from '../../types';
import { motion } from 'framer-motion';

interface Props {
  categories: Category[];
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
}

export const CategoryTable: React.FC<Props> = ({ categories, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto rounded-lg shadow-sm bg-gray-800/50 backdrop-blur-md">
      <table className="min-w-full divide-y divide-gray-700 text-sm">
        <thead className="bg-gray-900/70">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-200">Nombre</th>
            <th className="px-4 py-2 text-left font-medium text-gray-200">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {categories.map((cat) => (
            <motion.tr
              key={cat.id}
              whileHover={{ backgroundColor: 'rgba(55,65,81,0.7)' }}
              className="transition-colors"
            >
              <td className="px-4 py-2 text-gray-100">{cat.nombre}</td>
              <td className="px-4 py-2 flex space-x-2">
                <button
                  onClick={() => onEdit(cat)}
                  className="p-1 rounded hover:bg-gray-700/50 text-gray-300"
                >
                  <LucideEdit size={18} />
                </button>
                <button
                  onClick={() => onDelete(cat.id)}
                  className="p-1 rounded hover:bg-red-600/40 text-red-400"
                >
                  <LucideTrash size={18} />
                </button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
