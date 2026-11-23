import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.routes.js';
import asignacionRoutes from './routes/asignacion.routes.js';
import categoriaRoutes from './routes/categoria.routes.js';
import departamentoRoutes from './routes/departamento.routes.js';
import compraRoutes from './routes/compra.routes.js';
import empresaRoutes from './routes/empresa.routes.js';
import facturaRoutes from './routes/factura.routes.js';
import inventarioRoutes from './routes/inventario.routes.js';
import pedidoRoutes from './routes/pedido.routes.js';
import productoRoutes from './routes/producto.routes.js';
import proveedorRoutes from './routes/proveedor.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import usuarioRoutes from './routes/usuario.routes.js';
import { verificarToken } from './middlewares/auth.middleware.js';
import { csrfProtection } from './middlewares/csrf.middleware.js';
import { apiRateLimiter } from './middlewares/rateLimit.middleware.js';
import { stream as eventStream } from './controllers/events.controller.js';
import { iniciarLimpiezaPeriodicaSesiones } from './services/session.service.js';
import { enviarErrorInterno } from './utils/errorHandler.js';
import { isDevelopment, isOriginAllowed } from './utils/origins.js';

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (!isDevelopment()) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  const ruta = (req.originalUrl || '').split('?')[0];
  if (
    ruta.startsWith('/api/') &&
    ruta !== '/api/health' &&
    ruta !== '/api/events/stream'
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
});

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // Postman, curl, etc.
      if (isOriginAllowed(origin)) {
        return cb(null, true); // refleja el origen exacto
      }

      const corsErr = new Error('Origen no permitido por CORS');
      corsErr.status = 403;
      corsErr.isCorsError = true;
      return cb(corsErr);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', apiRateLimiter);
app.use('/api', csrfProtection);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', sistema: 'SICAT' });
});

app.use('/api/auth', authRoutes);
app.use('/api/asignaciones', asignacionRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/departamentos', departamentoRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/facturas', facturaRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.get('/api/events/stream', verificarToken, eventStream);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, _req, res, _next) => {
  if (err?.isCorsError) {
    return res.status(403).json({ error: 'Origen no permitido por CORS' });
  }
  if (err?.name === 'MulterError') {
    return res.status(400).json({ error: err.message || 'Error al procesar el archivo subido' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La petición supera el tamaño máximo permitido (1 MB)' });
  }
  if (err?.status >= 400 && err?.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  return enviarErrorInterno(res, err, 'express.global');
});

iniciarLimpiezaPeriodicaSesiones();

app.listen(PORT, () => {
  console.log(`SICAT backend corriendo en http://localhost:${PORT}`);
});
