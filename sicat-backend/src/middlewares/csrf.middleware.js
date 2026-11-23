import { getSessionTokenFromRequest, isSameSiteMode } from '../utils/cookieConfig.js';
import { isOriginAllowed } from '../utils/origins.js';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protección anti-CSRF para peticiones mutadoras sobre /api/*.
 * Valida Origin/Referer contra la lista blanca, bloquea Sec-Fetch-Site cross-site
 * en modo same-site y exige cabecera personalizada en mutaciones autenticadas con cookie.
 */
export function csrfProtection(req, res, next) {
  if (METODOS_SEGUROS.has(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    if (!isOriginAllowed(origin)) {
      return res.status(403).json({ error: 'Origen no permitido' });
    }
  } else if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!isOriginAllowed(refOrigin)) {
        return res.status(403).json({ error: 'Origen de referencia no permitido' });
      }
    } catch {
      return res.status(403).json({ error: 'Origen de referencia no permitido' });
    }
  }

  if (isSameSiteMode() && req.headers['sec-fetch-site'] === 'cross-site') {
    return res.status(403).json({ error: 'Solicitud cross-site bloqueada' });
  }

  const tieneCookieSesion = Boolean(getSessionTokenFromRequest(req));
  if (tieneCookieSesion && req.headers['x-sicat-client'] !== 'web') {
    return res.status(403).json({ error: 'Cabecera de seguridad CSRF faltante o inválida' });
  }

  return next();
}
