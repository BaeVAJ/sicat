import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    'X-SICAT-Client': 'web',
  },
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthProbeOrAction =
      url.includes('/auth/login') ||
      url.includes('/auth/me') ||
      url.includes('/auth/logout');
    const isAlreadyOnLogin =
      typeof window !== 'undefined' &&
      window.location.pathname.toLowerCase() === '/login';

    if (err.response?.status === 401 && !isAuthProbeOrAction && !isAlreadyOnLogin) {
      window.location.href = '/Login';
    }
    return Promise.reject(err);
  }
);

export default client;
