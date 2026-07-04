import React from "react";
import { Search, Filter, Plus } from "lucide-react";

interface ProductFiltersProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onNewProduct: () => void;
}

export default function ProductFilters({ searchTerm, onSearchChange, onNewProduct }: ProductFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          Gestión de Productos
        </h2>
        <p className="text-gray-400 text-sm mt-1">Administra el inventario de la empresa</p>
      </div>
      
      <div className="flex w-full sm:w-auto gap-3">
        <div className="relative flex-1 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar producto..." 
            className="premium-input pl-10 py-2 text-sm"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <button className="btn-secondary py-2 px-4 flex items-center gap-2 text-sm">
          <Filter size={18} /> Filtros
        </button>
        <button onClick={onNewProduct} className="btn-primary py-2 px-4 flex items-center gap-2 text-sm whitespace-nowrap">
          <Plus size={18} /> Nuevo Producto
        </button>
      </div>
    </div>
  );
}
