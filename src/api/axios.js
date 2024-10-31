// frontend/src/services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://mern-calendar-app-61i9.onrender.com';

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Add email to all requests
axiosInstance.interceptors.request.use((config) => {
  const email = localStorage.getItem('userEmail');
  
  // Add email to query params for GET requests
  if (config.method === 'get') {
    config.params = {
      ...config.params,
      email
    };
  }
  
  // Add email to body for other requests
  if (['post', 'put', 'delete'].includes(config.method)) {
    config.data = {
      ...config.data,
      email
    };
  }
  
  return config;
});

// Handle auth errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear local storage and redirect to home on auth error
      localStorage.clear();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;