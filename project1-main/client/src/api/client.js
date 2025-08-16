// src/api/client.js
import axios from 'axios';
import config from '../config';

const apiClient = axios.create({
  baseURL: config.API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

// JWT interceptor - automatically adds token to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handles token expiry
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;