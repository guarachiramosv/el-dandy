import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { Product } from "../../../types";

interface DeleteModalProps {
  isOpen: boolean;
  product?: Product | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmationModal({ isOpen, product, onClose, onConfirm }: DeleteModalProps) {
  if (!isOpen || !product) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-grafito-800 border border-red-900/30 rounded-2xl shadow-premium p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-accent flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Desactivar Producto</h3>
          <p className="text-gray-400 mb-6">
            El producto <span className="text-white font-semibold">{product.codigo} - {product.descripcion}</span> será desactivado pero su historial permanecerá para mantener integridad del ERP.
          </p>
          <div className="w-full flex gap-3">
            <button onClick={onClose} className="flex-1 btn-secondary">Cancelar</button>
            <button onClick={onConfirm} className="flex-1 btn-danger">Desactivar producto</button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
