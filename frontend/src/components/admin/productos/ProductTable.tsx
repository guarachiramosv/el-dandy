import { motion, AnimatePresence } from "framer-motion";
import { Edit, Trash2, ImageIcon, Eye, RotateCcw, Plus } from "lucide-react";
import { useState } from "react";
import ImageLightbox from "../../ImageLightbox";
import { Product } from "../../../types";
import { productImageUrl } from "../../../utils/images";

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onView: (product: Product) => void;
  onAddStock?: (product: Product) => void;
  onRestore?: (product: Product) => void;
}

export default function ProductTable({ products, onEdit, onDelete, onView, onAddStock, onRestore }: ProductTableProps) {
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null);

  const getStockColor = (stock: number) => {
    if (stock > 10) return "bg-green-500";
    if (stock > 0) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getConditionLabel = (condition: string) => condition === "NUEVO" ? "Nuevo" : "Usado";
  const getProductStatus = (product: Product) => product.estado || (product.activo === false ? "INACTIVO" : "ACTIVO");
  const getCoverImage = (product: Product) => product.imagenes?.[0]?.url || product.imagen;

  const statusStyles = {
    ACTIVO: "bg-green-500/10 text-green-300 border-green-500/25",
    INACTIVO: "bg-gray-500/10 text-gray-300 border-gray-500/25",
    DESCONTINUADO: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  };

  return (
    <div className="glass-panel overflow-hidden flex-1 flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-grafito-800/80 border-b border-gray-700 text-sm uppercase text-gray-400 tracking-wider">
              <th className="p-4 font-medium">Img</th>
              <th className="p-4 font-medium">Codigo</th>
              <th className="p-4 font-medium">Descripcion</th>
              <th className="p-4 font-medium">Cat. / Marca</th>
              <th className="p-4 font-medium">Condicion</th>
              <th className="p-4 font-medium">Estado</th>
              <th className="p-4 font-medium">Stock</th>
              <th className="p-4 font-medium">Precio</th>
              <th className="p-4 font-medium">Estante</th>
              <th className="p-4 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            <AnimatePresence>
              {products.map((product) => {
                const estado = getProductStatus(product);
                const coverImage = getCoverImage(product);
                return (
                  <motion.tr
                    key={product.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-grafito-800/50 transition-colors group"
                  >
                  <td className="p-4">
                    <div className="relative w-10 h-10">
                      {productImageUrl(coverImage) ? (
                        <button
                          type="button"
                          onClick={() => setLightboxImage({ url: productImageUrl(coverImage)!, alt: product.descripcion })}
                          className="block"
                          title="Ver imagen"
                        >
                          <img src={productImageUrl(coverImage)!} alt={product.descripcion} className="w-10 h-10 rounded-lg object-cover border border-gray-700" />
                        </button>
                      ) : <div className="w-10 h-10 rounded-lg bg-grafito-600 flex items-center justify-center border border-gray-700"><ImageIcon size={18} className="text-gray-400" /></div>}
                      {(product.imagenes?.length || 0) > 1 && (
                        <span className="absolute -right-2 -top-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {product.imagenes?.length}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm text-gray-300">{product.codigo}</td>
                  <td className="p-4 font-medium text-white">{product.descripcion}</td>
                  <td className="p-4 text-sm text-gray-400">
                    <span className="block">{product.categoria?.nombre || "Sin categoria"}</span>
                    <span className="text-xs text-gray-500">{product.marca}</span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                      product.condicion === "NUEVO"
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                    }`}>
                      {getConditionLabel(product.condicion)}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${statusStyles[estado]}`}>
                      {estado}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStockColor(product.stock)}`} />
                        <span className={`font-semibold ${product.stock === 0 ? "text-red-400" : "text-gray-200"}`}>
                          {product.stock}
                        </span>
                      </div>
                      {(product.stockSucursales?.length || 0) > 0 && (
                        <div className="space-y-0.5 text-xs text-gray-500">
                          {product.stockSucursales?.map((item) => (
                            <div key={item.id} className={item.estado === "ACTIVO" || !item.estado ? "" : "text-amber-400"}>
                              {item.sucursal?.nombre || "Sucursal"}: {item.stock}
                              {item.estado && item.estado !== "ACTIVO" ? ` (${item.estado})` : ""}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-medium text-primary-light">
                    Bs {product.precioVenta.toLocaleString()}
                  </td>
                  <td className="p-4 text-sm text-gray-400">
                    <span className="block">{product.ubicacion || "Sin ubicacion"}</span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onView(product)} className="p-2 text-gray-400 hover:text-white hover:bg-grafito-600 rounded-lg transition-colors" title="Ver detalle">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => onEdit(product)} className="p-2 text-gray-400 hover:text-white hover:bg-grafito-600 rounded-lg transition-colors" title="Editar">
                        <Edit size={16} />
                      </button>
                      {estado === "ACTIVO" && (
                        <button onClick={() => onAddStock?.(product)} className="p-2 text-gray-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors" title="Agregar stock">
                          <Plus size={16} />
                        </button>
                      )}
                      {estado !== "ACTIVO" ? (
                        <button onClick={() => onRestore?.(product)} className="p-2 text-gray-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors" title="Restaurar">
                          <RotateCcw size={16} />
                        </button>
                      ) : (
                        <button onClick={() => onDelete(product)} className="p-2 text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors" title="Eliminar con motivo">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {products.length === 0 && (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <p className="text-lg">No se encontraron productos</p>
          </div>
        )}
      </div>
      <ImageLightbox imageUrl={lightboxImage?.url || null} alt={lightboxImage?.alt} onClose={() => setLightboxImage(null)} />
    </div>
  );
}
