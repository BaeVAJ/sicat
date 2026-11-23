import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

/**
 * Limita intentos fallidos de inicio de sesión por IP + correo (10 cada 15 min).
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ipKey = ipKeyGenerator(req.ip || '127.0.0.1');
    const correo =
      typeof req.body?.correo === 'string'
        ? req.body.correo.trim().toLowerCase()
        : '';
    return `${ipKey}:${correo}`;
  },
  message: {
    error: 'Demasiados intentos de inicio de sesión fallidos. Espera 15 minutos e intenta nuevamente.',
  },
});

/**
 * Limita la tasa general de peticiones sobre /api/* (300 por minuto por IP).
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/events/stream' || req.originalUrl === '/api/health' || req.originalUrl === '/api/events/stream',
  message: {
    error: 'Demasiadas solicitudes. Intenta nuevamente en un momento.',
  },
});
