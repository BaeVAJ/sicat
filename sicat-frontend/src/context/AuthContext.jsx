import { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario]   = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token    = localStorage.getItem('token');
    const guardado = localStorage.getItem('usuario');
    if (token && guardado) setUsuario(JSON.parse(guardado));
    setCargando(false);
  }, []);

  async function login(correo, contrasena) {
    const { data } = await client.post('/auth/login', { correo, contrasena });
    localStorage.setItem('token',   data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}