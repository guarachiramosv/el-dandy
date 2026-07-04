// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

// Request interceptor – could add auth token later
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor – unified error shape
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ensure API returns our { success, error } shape
    const msg = error.response?.data?.error || error.message;
    return Promise.reject(new Error(msg));
  }
);

export default api;
