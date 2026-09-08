import eventBus from '../services/eventBus.js';

export function stream(req, res) {
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
  });
}
