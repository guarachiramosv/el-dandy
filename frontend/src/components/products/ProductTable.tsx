// src/components/products/ProductTable.tsx
import React from 'react';
import { LucideEdit, LucideTrash } from 'lucide-react';
import { Product } from '../../types';
import { motion } from 'framer-motion';

interface Props {
  products: Product[];
  onEdit: (prod: Product) => void;
  onDelete: (id: string) => void;
}

export const ProductTable: React.FC<Props> = ({ products, onEdit, onDelete }) => (
  <div className="overflow-x-auto rounded-lg shadow-sm bg-gray-800/50 backdrop-blur-md">
    <table className="min-w-full divide-y divide-gray-700 text-sm">
      <thead className="bg-gray-900/70">
        <tr>
          <th className="px-4 py-2 text-left font-medium text-gray-200">Código</th>
          <th className="px-4 py-2 text-left font-medium text-gray-200">Descripción</th>
          <th className="px-4 py-2 text-left font-medium text-gray-200">Marca</th>
          <th className="px-4 py-2 text-left font-medium text-gray-200">Condición</th>
          <th className="px-4 py-2 text-left font-medium text-gray-200">Stock</th>
          <th className="px-4 py-2 text-left font-medium text-gray-200">Precio Venta</th>
          <th className="px-4 py-2 text-left font-medium text-gray-200">Categoría</th>
          <th className="px-4 py-2 text-left font-medium text-gray-200">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-700">
        {products.map(prod => (
          <motion.tr
            key={prod.id}
            whileHover={{ backgroundColor: 'rgba(55,65,81,0.7)' }}
            className="transition-colors"
          >
            <td className="px-4 py-2 text-gray-100">{prod.codigo}</td>
            <td className="px-4 py-2 text-gray-100">{prod.descripcion}</td>
            <td className="px-4 py-2 text-gray-100">{prod.marca}</td>
            <td className="px-4 py-2 text-gray-100">{prod.condicion}</td>
            <td className="px-4 py-2 text-gray-100">
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  prod.stock <= 5 ? 'bg-red-600/70 text-white' : 'bg-green-600/70 text-white'
                }`}
              >
                {prod.stock}
              </span>
            </td>
            <td className="px-4 py-2 text-gray-100">${prod.precioVenta.toFixed(2)}</td>
            <td className="px-4 py-2 text-gray-100">{prod.categoria?.nombre ?? ''}</td>
            <td className="px-4 py-2 flex space-x-2">
              <button
                onClick={() => onEdit(prod)}
                className="p-1 rounded hover:bg-gray-700/50 text-gray-300"
              >
                <LucideEdit size={18} />
              </button>
              <button
                onClick={() => onDelete(prod.id)}
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
