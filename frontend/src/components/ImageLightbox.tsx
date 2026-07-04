import { X } from "lucide-react";

type ImageLightboxProps = {
  imageUrl: string | null;
  alt?: string;
  onClose: () => void;
};

export default function ImageLightbox({ imageUrl, alt = "Imagen", onClose }: ImageLightboxProps) {
  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
        aria-label="Cerrar imagen"
      >
        <X size={24} />
      </button>
      <img
        src={imageUrl}
        alt={alt}
        className="max-h-[90vh] max-w-[95vw] object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
