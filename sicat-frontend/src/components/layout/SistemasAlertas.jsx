import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import notificacionSonido from '../../assets/notification.wav';
import './sistemas-alertas.css';

const eventTypes = [
    'ticket.created',
    'ticket.updated',
    'material-request.created',
    'material-request.updated',
];

function esSistemas() {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
        return usuario?.departamento?.toLowerCase().includes('sistema') === true;
    } catch {
        return false;
    }
}

function tokenExpirado(token) {
    try {
        const { exp } = JSON.parse(atob(token.split('.')[1]));
        return Date.now() >= exp * 1000;
    } catch {
        return true;
    }
}

function sesionValida() {
    const token = localStorage.getItem('token');
    return token && !tokenExpirado(token) && esSistemas() ? token : null;
}

function SistemasAlertas() {
    const [alertas, setAlertas] = useState([]);
    const navigate = useNavigate();
    const audioRef = useRef(null);

    useEffect(() => {
        audioRef.current = new Audio(notificacionSonido);
        audioRef.current.preload = 'auto';
    }, []);

    const reproducirNotificacion = () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = 0;
        audio.play().catch(() => {});
    };

    useEffect(() => {
        let source = null;
        let reconnectTimer = null;
        let stopped = false;

        const conectar = () => {
            // ✅ Evita doble conexión (fix Problema 5)
            if (stopped || source) return;

            const token = sesionValida();
            if (!token) return;

            source = new EventSource(
                `${import.meta.env.VITE_API_URL || '/api'}/events/stream?token=${encodeURIComponent(token)}`
            );

            eventTypes.forEach((type) => {
                source.addEventListener(type, (event) => {
                    try {
                        const esCreacion = type.endsWith('.created');
                        if (!esCreacion) return;

                        const data = JSON.parse(event.data);
                        const id =
                            data.payload?.id_ticket ??
                            data.payload?.id_pedido ??
                            '';
                        const esTicket = type.startsWith('ticket.');
                        const alerta = {
                            id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            esTicket,
                            registroId: id,
                        };

                        setAlertas((actuales) => [...actuales, alerta]);
                        reproducirNotificacion();
                        window.setTimeout(() => {
                            setAlertas((actuales) =>
                                actuales.filter((actual) => actual.id !== alerta.id)
                            );
                        }, 10000);
                    } catch {
                        console.warn('[SICAT] No se pudo leer una advertencia en tiempo real.');
                    }
                });
            });

            source.addEventListener('error', () => {
                if (stopped) return;
                console.warn('[SICAT] SSE reconectando…');
                if (source && source.readyState === EventSource.CLOSED) {
                    source.close();
                    source = null;
                    reconnectTimer = window.setTimeout(conectar, 5000);
                }
            });
        };

        conectar();

        const revisarSesion = window.setInterval(() => {
            const token = sesionValida();
            if (!token && source) {
                source.close();
                source = null;
            } else if (!source && token) {
                conectar();
            }
        }, 1000);

        return () => {
            stopped = true;
            window.clearInterval(revisarSesion);
            window.clearTimeout(reconnectTimer);
            source?.close();
            source = null;
        };
    }, []);

    const cerrar = (id) => {
        const elemento = document.querySelector(`.sistemas-alerta[data-alerta-id="${id}"]`);
        const eliminar = () =>
            setAlertas((actuales) => actuales.filter((alerta) => alerta.id !== id));

        if (elemento) {
            elemento.classList.add('sistemas-alerta--saliendo');
            window.setTimeout(eliminar, 300);
        } else {
            eliminar();
        }
    };

    return (
        <div className="sistemas-alertas" aria-live="polite" aria-label="Advertencias en tiempo real">
            {alertas.map((alerta) => (
                <article
                    data-alerta-id={alerta.id}
                    className={`sistemas-alerta ${
                        alerta.esTicket ? 'sistemas-alerta--ticket' : 'sistemas-alerta--material'
                    }`}
                    key={alerta.id}
                >
                    <div className="sistemas-alerta__icono" aria-hidden="true">
                        {alerta.esTicket ? (
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M5 12.0002C5 10.694 4.16519 9.58273 3 9.1709V7.6C3 7.03995 3 6.75992 3.10899 6.54601C3.20487 6.35785 3.35785 6.20487 3.54601 6.10899C3.75992 6 4.03995 6 4.6 6H19.4C19.9601 6 20.2401 6 20.454 6.10899C20.6422 6.20487 20.7951 6.35785 20.891 6.54601C21 6.75992 21 7.03995 21 7.6V9.17071C19.8348 9.58254 19 10.694 19 12.0002C19 13.3064 19.8348 14.4175 21 14.8293V16.4C21 16.9601 21 17.2401 20.891 17.454C20.7951 17.6422 20.6422 17.7951 20.454 17.891C20.2401 18 19.9601 18 19.4 18H4.6C4.03995 18 3.75992 18 3.54601 17.891C3.35785 17.7951 3.20487 17.6422 3.10899 17.454C3 17.2401 3 16.9601 3 16.4V14.8295C4.16519 14.4177 5 13.3064 5 12.0002Z"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M5.5 8.80835C5.5 8.80835 5 10.6111 5 13.5C5 16.3889 5.38889 18.9167 5.77778 19.2778C6.16667 19.6389 8.88889 20 12 20C15.1111 20 17.8333 19.6389 18.2222 19.2778C18.6111 18.9167 19 16.3889 19 13.5C19 10.6111 18.5 8.80835 18.5 8.80835M5.5 8.80835C6.65798 8.91328 9.19021 9 12 9C14.8098 9 17.342 8.91328 18.5 8.80835M5.5 8.80835C5.19265 8.7805 4.98211 8.75135 4.88889 8.72222C4.44444 8.58333 4 7.61111 4 6.5C4 5.38889 4.44444 4.41667 4.88889 4.27778C5.33333 4.13889 8.44444 4 12 4C15.5556 4 18.6667 4.13889 19.1111 4.27778C19.5556 4.41667 20 5.38889 20 6.5C20 7.61111 19.5556 8.58333 19.1111 8.72222C19.0179 8.75135 18.8074 8.7805 18.5 8.80835M10 13C10 13 10.5 12.5 12 12.5C13.5 12.5 14 13 14 13"
                                    stroke="#ffffff"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                    </div>

                    <div className="sistemas-alerta__contenido">
                        <strong>
                            {alerta.esTicket ? 'Ticket recibido' : 'Pedido de material recibido'}
                        </strong>
                        <span>
                            {alerta.esTicket
                                ? `Ticket #${alerta.registroId} disponible para atención.`
                                : `Pedido #${alerta.registroId} disponible para atención.`}
                        </span>
                    </div>

                    <div className="sistemas-alerta__acciones">
                        <button
                            type="button"
                            className="sistemas-alerta__ver"
                            onClick={() => navigate(alerta.esTicket ? '/tickets' : '/compras')}
                        >
                            Ver
                        </button>
                        <button
                            type="button"
                            className="sistemas-alerta__cerrar"
                            aria-label="Cerrar advertencia"
                            onClick={() => cerrar(alerta.id)}
                        >
                            ×
                        </button>
                    </div>

                    <div className="sistemas-alerta__progreso" aria-hidden="true" />
                </article>
            ))}
        </div>
    );
}

export default SistemasAlertas;