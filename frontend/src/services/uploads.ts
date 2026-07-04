import api from './api';

export const uploadProductImage = async (productId: string, file: File) => {
  const form = new FormData();
  form.append('image', file);
  const response = await api.post(`/upload/products/${productId}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
};

export const uploadProductImages = async (productId: string, files: File[]) => {
  const form = new FormData();
  files.forEach((file) => form.append('images', file));
  const response = await api.post(`/upload/products/${productId}/images`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
};
