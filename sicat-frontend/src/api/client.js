import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url?.includes('/auth/login');
    if (!isLoginRequest && (err.response?.status === 401 || err.response?.status === 403)) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/Login';
    }
    return Promise.reject(err);
  }
);

export default client;