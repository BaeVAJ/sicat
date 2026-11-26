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

function createConnection() {
    const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

    const source = new EventSource(
        `${baseUrl}/events/stream`,
        { withCredentials: true }
    );

    const handlers = eventTypes.map((type) => {
        const handler = (event) => {
            let payload;

            try {
                payload = JSON.parse(event.data);
            } catch {
                return;
            }

            subscribers.forEach((subscriber) => {
                subscriber(type, payload);
            });
        };

        source.addEventListener(type, handler);

        return [type, handler];
    });

    const onSessionRevoked = () => {
        closeConnection();
        if (typeof window !== 'undefined' && window.location.pathname.toLowerCase() !== '/login') {
            window.location.href = '/Login';
        }
    };
    source.addEventListener('session_revoked', onSessionRevoked);
    handlers.push(['session_revoked', onSessionRevoked]);

    source.onerror = () => {
        if (source.readyState === EventSource.CLOSED) {
            console.warn(
                '[SICAT] SSE cerrado, se recreará en el próximo subscribe.'
            );

            closeConnection();
        }
    };

    return {
        source,
        handlers
    };
}

export function subscribeToEvents(onEvent) {
    if (typeof onEvent !== 'function') {
        return () => {};
    }

    if (!connection) {
        connection = createConnection();
    }

    subscribers.add(onEvent);

    return () => {
        subscribers.delete(onEvent);

        if (subscribers.size === 0) {
            closeConnection();
        }
    };
}