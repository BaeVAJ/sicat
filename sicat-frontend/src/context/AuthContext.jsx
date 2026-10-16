import { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario]   = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargarUsuario = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
                credentials: 'include',
            });
            if (!res.ok) {
                setUsuario(null);
                return;
            }
            const data = await res.json();
            setUsuario(data);
        } catch {
            setUsuario(null);
        } finally {
            setCargando(false);
        }
    };
    
    async function login(correo, contrasena, maxIntentos = 2) {
    for (let intento = 1; intento <= maxIntentos; intento++) {
      try {
        const { data } = await client.post('/auth/login', { correo, contrasena });
        setUsuario(data.usuario);
        return data.usuario;
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error || err.message || '';
        const isColdStart =
          status === 502 ||
          status === 503 ||
          status === 504 ||
          err.code === 'ERR_NETWORK' ||
          msg.includes('502') ||
          msg.includes('Network Error');

        // Si el servidor apenas está iniciando (502 / cold start) y no es el último intento, esperar 1.5s y reintentar
        if (isColdStart && intento < maxIntentos) {
          console.warn(`[Login] Backend en inicio (502), reintentando en 1.5s (intento ${intento + 1}/${maxIntentos})...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }

        throw err;
      }
    }
  }
  
  useEffect(() => {
    cargarUsuario();
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, cargando, cargarUsuario, login }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}