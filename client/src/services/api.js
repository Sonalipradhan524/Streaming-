import axios from 'axios';

// Backend URL - production (Render) / fallback to localhost for dev
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://streaming-dsjf.onrender.com/api';

// Create Axios Instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token to authorization header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('livelink_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiry / authorization errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and user info on auth error
      localStorage.removeItem('livelink_token');
      localStorage.removeItem('livelink_user');
      
      // We can trigger a page reload or let the AuthContext handle it
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
