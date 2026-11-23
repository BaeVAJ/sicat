import { isDevelopment } from './origins.js';

const SESSION_TTL_HOURS = Math.max(1, Number(process.env.SESSION_TTL_HOURS) || 12);
export const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;
export const SESSION_IDLE_MINUTES = Math.max(5, Number(process.env.SESSION_IDLE_MINUTES) || 120);

export const LEGACY_COOKIE_NAME = 'auth_token';

/**
 * Indica si el frontend y el backend operan bajo el mismo sitio/origen
 * (por ejemplo, detrás de un proxy /api en Cloudflare Workers).
 */
export function isSameSiteMode() {
  return (process.env.COOKIE_SAMESITE_MODE || 'cross-site').toLowerCase() === 'same-site';
}

/**
 * Nombre de la cookie de sesión; usa el prefijo __Host- en producción same-site.
 */
export function getSessionCookieName() {
  if (!isDevelopment() && isSameSiteMode()) {
    return '__Host-sicat_session';
  }
  return LEGACY_COOKIE_NAME;
}

/**
 * Opciones seguras para emitir la cookie de sesión (política fail-closed).
 */
export function getSessionCookieOptions() {
  const dev = isDevelopment();
  const sameSite = dev ? 'lax' : (isSameSiteMode() ? 'lax' : 'none');

  return {
    httpOnly: true,
    secure: !dev,
    sameSite,
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

/**
 * Opciones usadas para borrar la cookie (mismos atributos sin maxAge).
 */
export function getClearCookieOptions() {
  const { maxAge: _omit, ...clearOptions } = getSessionCookieOptions();
  return clearOptions;
}

/**
 * Extrae el token opaco de sesión desde las cookies de la petición.
 */
export function getSessionTokenFromRequest(req) {
  const cookieName = getSessionCookieName();
  return req.cookies?.[cookieName] || req.cookies?.[LEGACY_COOKIE_NAME] || null;
}

/**
 * Limpia la cookie de sesión activa (y la heredada si cambió el nombre).
 */
export function clearSessionCookies(res) {
  const cookieName = getSessionCookieName();
  const clearOptions = getClearCookieOptions();
  res.clearCookie(cookieName, clearOptions);

  if (cookieName !== LEGACY_COOKIE_NAME) {
    res.clearCookie(LEGACY_COOKIE_NAME, clearOptions);
  }
}
