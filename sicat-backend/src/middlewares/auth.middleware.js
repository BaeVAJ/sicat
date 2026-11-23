import { validarSesion } from '../services/session.service.js';
import {
  clearSessionCookies,
  getSessionTokenFromRequest,
} from '../utils/cookieConfig.js';
import { enviarErrorInterno } from '../utils/errorHandler.js';

export async function verificarToken(req, res, next) {
  const token = getSessionTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Sesión requerida' });
  }

  try {
    const result = await validarSesion(token);
    if (!result.ok) {
      clearSessionCookies(res);
      if (result.reason === 'ACCOUNT_DISABLED') {
        return res.status(401).json({
          error: 'Tu cuenta no está activa. Contacta al administrador.',
          code: 'ACCOUNT_DISABLED',
        });
      }
      if (result.reason === 'IDLE_EXPIRED') {
        return res.status(401).json({
          error: 'Tu sesión expiró por inactividad. Ingresa de nuevo.',
          code: 'IDLE_EXPIRED',
        });
      }
      return res.status(401).json({
        error: 'Sesión inválida o expirada. Ingresa a tu cuenta de nuevo.',
        code: 'SESSION_INVALID',
      });
    }

    req.usuario = result.usuario;
    req.sessionHash = result.tokenHash;
    return next();
  } catch (err) {
    return enviarErrorInterno(res, err, 'auth.verificarToken');
  }
}

export function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.usuario?.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta accion' });
    }
    return next();
  };
}
