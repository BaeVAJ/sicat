const eventTypes = [
    'inventory.created',
    'inventory.updated',
    'inventory.deleted',
    'material-request.created',
    'material-request.updated',
    'ticket.created',
    'ticket.updated',
    'assignment.created',
    'assignment.returned',
];

let connection = null;
const subscribers = new Set();

function closeConnection() {
    if (!connection) return;
    connection.handlers.forEach(([type, handler]) =>
        connection.source.removeEventListener(type, handler)
    );
    connection.source.close();
    connection = null;
}

function createConnection(token) {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const source = new EventSource(
        `${baseUrl}/events/stream?token=${encodeURIComponent(token)}`
    );

    const handlers = eventTypes.map((type) => {
        const handler = (event) => {
            let payload;
            try {
                payload = JSON.parse(event.data);
            } catch {
                return;
            }
            subscribers.forEach((subscriber) => subscriber(type, payload));
        };

        source.addEventListener(type, handler);
        return [type, handler];
    });

    // ✅ No cerrar en error: dejar reconectar. Solo cerrar si el stream queda CLOSED.
    source.onerror = () => {
        if (source.readyState === EventSource.CLOSED) {
            console.warn('[SICAT] SSE cerrado, se recreará en el próximo subscribe.');
            closeConnection();
        }
    };

    return { source, handlers, token };
}

export function subscribeToEvents(onEvent) {
    const token = localStorage.getItem('token');
    if (!token || typeof onEvent !== 'function') return () => {};

    if (connection && connection.token !== token) closeConnection();
    if (!connection) connection = createConnection(token);

    subscribers.add(onEvent);

    return () => {
        subscribers.delete(onEvent);
        if (subscribers.size === 0) closeConnection();
    };
}