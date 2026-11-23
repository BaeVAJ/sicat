export const PREVIEW_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+-sicat\.22670030\.workers\.dev$/;

/**
 * Política fail-closed: solo se considera entorno de desarrollo cuando
 * NODE_ENV es explícitamente 'development'.
 */
export function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

/**
 * Construye la lista blanca exacta de orígenes permitidos para CORS y CSRF.
 */
export function getAllowedOrigins() {
  const origins = ['https://sicat.22670030.workers.dev'];

  if (isDevelopment()) {
    origins.push('http://localhost:5173', 'http://localhost:3000');
  }

  if (process.env.EXTRA_CORS_ORIGINS) {
    process.env.EXTRA_CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .forEach((origin) => origins.push(origin));
  }

  return origins;
}

/**
 * Verifica si un Origin HTTP pertenece a la lista blanca exacta.
 */
export function isOriginAllowed(origin) {
  if (typeof origin !== 'string' || !origin) return false;
  return getAllowedOrigins().includes(origin) || PREVIEW_ORIGIN_REGEX.test(origin);
}
