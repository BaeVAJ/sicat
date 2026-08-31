// src/components/Login/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isServerStarting, setIsServerStarting] = useState(false);
  const [loading, setLoading] = useState(false);

  const isValid = correo.trim() !== '' && contrasena.trim() !== '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsServerStarting(false);
    setLoading(true);

    try {
      const usuario = await login(correo, contrasena);
      // Redirigir según el rol del usuario
      if (usuario.rol === 'admin' || usuario.rol === 'gerente') {
        navigate('/dashboardAdmin');
      } else {
        navigate('/dashboardUser');
      }
    } catch (err) {
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error || err.message || '';

      // Detección de error 502 / 503 / 504 / caída de red / cold start del backend
      const is502Error =
        status === 502 ||
        status === 503 ||
        status === 504 ||
        err.code === 'ERR_NETWORK' ||
        errorMsg.includes('502') ||
        errorMsg.includes('Network Error') ||
        errorMsg.includes('Bad Gateway');

      if (is502Error) {
        setIsServerStarting(true);
        setError(
          'El servidor se está iniciando o estableciendo conexión con la base de datos. Por favor, espera unos segundos e intenta nuevamente.'
        );
      } else if (status === 401) {
        setIsServerStarting(false);
        setError('Credenciales incorrectas. Verifica tu correo y contraseña.');
      } else {
        setIsServerStarting(false);
        setError(errorMsg || 'Error al conectar con el servidor.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* ── Brand header ── */}
        <div className="login-brand">
          <div className="login-brand__icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <rect x="9" y="10" width="6" height="5" rx="1" />
              <path d="M12 10V7a2 2 0 0 0-4 0" />
            </svg>
          </div>
          <h1 className="login-brand__title">SICAT</h1>
          <p className="login-brand__subtitle">Sistema Integral de Control</p>
        </div>

        {/* ── Error message ── */}
        {error && (
          <div
            className={`login-error ${isServerStarting ? 'login-error--warning' : ''}`}
            role="alert"
          >
            <span className="login-error__icon" aria-hidden="true">
              {isServerStarting ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </span>
            <div style={{ flex: 1, lineHeight: '1.4' }}>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'currentColor',
                opacity: 0.6,
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Cerrar aviso"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} noValidate>

          {/* Correo electrónico */}
          <div className="login-field">
            <label htmlFor="login-email" className="login-field__label">
              Correo electrónico
            </label>
            <div className="login-field__wrapper">
              <span className="login-field__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 7L2 7" />
                </svg>
              </span>
              <input
                id="login-email"
                className="login-field__input"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="usuario@empresa.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Contraseña */}
          <div className="login-field">
            <label htmlFor="login-password" className="login-field__label">
              Contraseña
            </label>
            <div className="login-field__wrapper">
              <span className="login-field__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="login-password"
                className="login-field__input"
                type={showPassword ? 'text' : 'password'}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                style={{ paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                className="login-field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="login-btn"
            disabled={!isValid || loading}
          >
            <span className="login-btn__content">
              {loading && <span className="login-spinner" aria-hidden="true" />}
              {loading ? (isServerStarting ? 'Conectando…' : 'Ingresando…') : 'Iniciar sesión'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;