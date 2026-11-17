import axios from 'axios';


  const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
  });
  client.interceptors.response.use(
    (res) => res,
    (err) => {
      const isLoginRequest = err.config?.url?.includes('/auth/login');
      if (!isLoginRequest && (err.response?.status === 401 || err.response?.status === 403)) {
        window.location.href = '/Login';
      }
      return Promise.reject(err);
    }
  );


export default client;