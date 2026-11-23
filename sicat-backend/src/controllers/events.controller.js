import eventBus from '../services/eventBus.js';

const conexionesPorUsuario = new Map();
const MAX_CONEXIONES_POR_USUARIO = 5;

export function stream(req, res) {
  const userId = req.usuario?.id_usuario ?? 'anon';
  const activas = conexionesPorUsuario.get(userId) || 0;
  if (activas >= MAX_CONEXIONES_POR_USUARIO) {
    return res.status(429).json({ error: 'Límite de conexiones en tiempo real alcanzado' });
  }
  conexionesPorUsuario.set(userId, activas + 1);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const esSistemas = String(req.usuario.departamento || '').toLowerCase().includes('sistema');

  const puedeRecibir = (event) => {
    return esSistemas
      && (event.type.startsWith('ticket.') || event.type.startsWith('material-request.'));
  };

  const send = (event) => {
    if (!puedeRecibir(event)) return;
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  eventBus.on('event', send);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('event', send);
    const restantes = (conexionesPorUsuario.get(userId) || 1) - 1;
    if (restantes <= 0) {
      conexionesPorUsuario.delete(userId);
    } else {
      conexionesPorUsuario.set(userId, restantes);
    }
  });
}
