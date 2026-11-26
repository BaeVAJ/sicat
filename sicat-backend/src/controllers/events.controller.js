import eventBus from '../services/eventBus.js';

const conexionesPorUsuario = new Map();
const MAX_CONEXIONES_POR_USUARIO = 5;

function cerrarEntradaStream(entrada) {
  try {
    entrada.res.write(`event: session_revoked\ndata: ${JSON.stringify({ revoked: true })}\n\n`);
  } catch {
    // El socket puede estar cerrado
  }
  entrada.cleanup();
  try {
    entrada.res.end();
  } catch {
    // Ignorar error si el socket ya cerró
  }
}

/**
 * Cierra todos los streams SSE abiertos de un usuario (p. ej. cambio de rol, suspensión o logoutAll).
 */
export function cerrarStreamsUsuario(idUsuario) {
  const entradas = conexionesPorUsuario.get(idUsuario);
  if (!entradas || entradas.size === 0) return 0;

  const lista = Array.from(entradas);
  lista.forEach(cerrarEntradaStream);
  return lista.length;
}

/**
 * Cierra los streams SSE asociados a un hash de sesión específico (p. ej. logout individual).
 */
export function cerrarStreamsSesion(sessionHash) {
  if (!sessionHash) return 0;
  const coincidentes = [];

  for (const entradas of conexionesPorUsuario.values()) {
    for (const entrada of entradas) {
      if (entrada.sessionHash === sessionHash) {
        coincidentes.push(entrada);
      }
    }
  }

  coincidentes.forEach(cerrarEntradaStream);
  return coincidentes.length;
}

export function stream(req, res) {
  const userId = req.usuario?.id_usuario ?? 'anon';
  const sessionHash = req.sessionHash || null;
  let activas = conexionesPorUsuario.get(userId);
  if (activas && activas.size >= MAX_CONEXIONES_POR_USUARIO) {
    return res.status(429).json({ error: 'Límite de conexiones en tiempo real alcanzado' });
  }
  if (!activas) {
    activas = new Set();
    conexionesPorUsuario.set(userId, activas);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const rol = req.usuario?.rol;
  const esSistemas = String(req.usuario?.departamento || '').toLowerCase().includes('sistema');
  const puedeGestionar = rol === 'admin' || rol === 'gerente' || esSistemas;

  const puedeRecibir = (event) => {
    const tipo = String(event?.type || '');
    if (puedeGestionar) {
      return (
        tipo.startsWith('ticket.') ||
        tipo.startsWith('material-request.') ||
        tipo.startsWith('inventory.') ||
        tipo.startsWith('assignment.')
      );
    }

    if (tipo.startsWith('ticket.') || tipo.startsWith('material-request.')) {
      return Number(event?.payload?.id_usuario) === Number(userId);
    }

    return false;
  };

  let cerrado = false;
  let heartbeat = null;
  let send = null;

  const entrada = { res, sessionHash, cleanup: () => {} };

  const cleanup = () => {
    if (cerrado) return;
    cerrado = true;
    if (heartbeat) clearInterval(heartbeat);
    if (send) eventBus.off('event', send);
    const setUsuario = conexionesPorUsuario.get(userId);
    if (setUsuario) {
      setUsuario.delete(entrada);
      if (setUsuario.size === 0) {
        conexionesPorUsuario.delete(userId);
      }
    }
  };
  entrada.cleanup = cleanup;

  send = (event) => {
    if (cerrado || !puedeRecibir(event)) return;
    try {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {
      cleanup();
    }
  };

  activas.add(entrada);
  eventBus.on('event', send);

  try {
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  } catch {
    cleanup();
    return;
  }

  heartbeat = setInterval(() => {
    if (cerrado) return;
    try {
      res.write(': heartbeat\n\n');
    } catch {
      cleanup();
    }
  }, 25000);

  req.on('close', cleanup);
}
