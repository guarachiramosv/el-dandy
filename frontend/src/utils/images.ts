const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:4000';

export const productImageUrl = (image?: string | null) => {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/uploads/')) return `${API_ORIGIN}${image}`;
  return `${API_ORIGIN}/uploads/${image.replace(/^\/+/, '')}`;
};
