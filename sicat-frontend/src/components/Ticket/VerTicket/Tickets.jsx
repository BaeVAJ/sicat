// src/components/Ticket/VerTicket/Tickets.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import { subscribeToEvents } from '../../../api/events';
import Layout from '../../layout/Layout';
import './Tickets.css';

const ESTADOS = {
    PENDIENTE: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    EN_PROCESO: { label: 'En proceso', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    SOLUCIONADO: { label: 'Solucionado', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

function Tickets() {
    const { usuario } = useAuth();
    const [userProfile, setUserProfile] = useState(null);

    // Cargar perfil completo si departamento no está en el token inicial
    useEffect(() => {
        let mounted = true;
        async function fetchProfile() {
            try {
                const { data } = await client.get('/auth/me');
                if (mounted && data) setUserProfile(data);
            } catch {
                // ignore
            }
        }
        fetchProfile();
        return () => { mounted = false; };
    }, []);

    // Solo admin, gerente y usuarios pertenecientes a Sistemas pueden gestionar y ver todos los tickets
    const esSistemas = useMemo(() => {
        const dep = (usuario?.departamento || userProfile?.departamento || '').toLowerCase();
        return dep.includes('sistema');
    }, [usuario, userProfile]);

    const puedeGestionar = usuario?.rol === 'admin' || usuario?.rol === 'gerente' || esSistemas;
    const isUsuario = !puedeGestionar;

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [activeTab, setActiveTab] = useState('tickets');
    const [pedidos, setPedidos] = useState([]);
    const [loadingPedidos, setLoadingPedidos] = useState(false);

    // Modal de Detalles
    const [ticketDetalle, setTicketDetalle] = useState(null);

    // Cargar tickets
    useEffect(() => {
        if (!usuario) return undefined;

        fetchTickets();
        return subscribeToEvents((type) => {
            if (type.startsWith('ticket.')) fetchTickets();
            if (type.startsWith('material-request.')) fetchPedidos();
        });
    }, [usuario]);

    async function fetchPedidos() {
        setLoadingPedidos(true);
        try {
            const { data } = await client.get('/pedidos');
            setPedidos(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cargar las solicitudes de material');
        } finally {
            setLoadingPedidos(false);
        }
    }

    useEffect(() => {
        if (activeTab === 'pedidos') fetchPedidos();
    }, [activeTab]);

    async function fetchTickets() {
        setLoading(true);
        setError('');
        try {
            const { data } = await client.get('/tickets');
            setTickets(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cargar los tickets');
        } finally {
            setLoading(false);
        }
    }

    // Filtrar los tickets si no puede gestionar: solo mostrar los que él mandó
    const ticketsMostrados = useMemo(() => {
        if (!puedeGestionar && usuario?.id_usuario) {
            return tickets.filter((t) => t.id_usuario === usuario.id_usuario);
        }
        return tickets;
    }, [tickets, puedeGestionar, usuario]);

    // Cambiar estado de un ticket (solo para admin, gerente o sistemas)
    async function cambiarEstado(id, nuevoEstado) {
        if (!puedeGestionar) return;
        setUpdatingId(id);
        setError('');
        try {
            const body = { estado: nuevoEstado };
            if (nuevoEstado === 'SOLUCIONADO') {
                body.fecha_solucion = new Date().toISOString().split('T')[0];
            }
            const { data } = await client.patch(`/tickets/${id}/estado`, body);
            setTickets((prev) =>
                prev.map((t) => (t.id_ticket === id ? { ...t, ...data } : t))
            );
            if (ticketDetalle && ticketDetalle.id_ticket === id) {
                setTicketDetalle((prev) => ({ ...prev, ...data }));
            }
            setSuccess(`Estado del ticket #${id} actualizado a ${ESTADOS[nuevoEstado]?.label || nuevoEstado}`);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al actualizar el estado');
        } finally {
            setUpdatingId(null);
        }
    }

    // Formatear fecha
    function formatFecha(fecha) {
        if (!fecha) return '—';
        return new Date(fecha).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }

    return (
        <Layout>
            <div className="dash-container">
                {/* Header */}
                <div className="dash-header">
                    <div>
                        <h1 className="dash-header__title">
                            {isUsuario ? 'Mis Tickets' : 'Sistema de Tickets'}
                        </h1>
                        <p className="dash-header__subtitle">
                            {isUsuario
                                ? 'Consulta el estado y seguimiento de los tickets que has enviado'
                                : `Gestión de Tickets — ${usuario?.rol === 'admin' ? 'Administrador' : usuario?.rol === 'gerente' ? 'Gerente' : 'Área de Sistemas'}`}
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <button className="dash-refresh" onClick={fetchTickets} disabled={loading}>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={loading ? 'dash-refresh__spin' : ''}
                            >
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            <span>Actualizar</span>
                        </button>

                        <Link to="/crear-ticket" className="dash-btn-primary">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span>Nuevo Ticket</span>
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="dash-stats">
                    {Object.entries(ESTADOS).map(([key, { label, color }]) => {
                        const count = ticketsMostrados.filter((t) => t.estado === key).length;
                        return (
                            <div key={key} className="dash-stat" style={{ borderColor: color }}>
                                <span className="dash-stat__count" style={{ color }}>{count}</span>
                                <span className="dash-stat__label">{label}</span>
                            </div>

                        );
                    })}
                    
                </div>

                <div role="tablist" style={{ display: 'flex', gap: '0.5rem', margin: '1.25rem 0' }}>
                    <button type="button" className={activeTab === 'tickets' ? 'dash-btn-primary' : 'dash-refresh'} onClick={() => setActiveTab('tickets')}>
                        Tickets de soporte
                    </button>
                    <button type="button" className={activeTab === 'pedidos' ? 'dash-btn-primary' : 'dash-refresh'} onClick={() => setActiveTab('pedidos')}>
                        Solicitudes de material {pedidos.filter((p) => p.estatus === 'PENDIENTE').length > 0 && `(${pedidos.filter((p) => p.estatus === 'PENDIENTE').length})`}
                    </button>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="dash-error">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        <span>{error}</span>
                        <button
                            type="button"
                            onClick={() => setError('')}
                            style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer' }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                {success && (
                    <div className="dash-success">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span>{success}</span>
                        <button
                            type="button"
                            onClick={() => setSuccess('')}
                            style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer' }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                {activeTab === 'pedidos' ? (
                    <div className="dash-table-wrap">
                        <table className="dash-table">
                            <thead><tr><th>ID</th><th>Material</th><th>Departamento</th><th>Stock</th><th>Solicitado</th><th>Estado</th><th>Acción</th></tr></thead>
                            <tbody>
                                {loadingPedidos ? <tr><td colSpan="7" className="dash-table__empty">Cargando solicitudes...</td></tr> : pedidos.length === 0 ? <tr><td colSpan="7" className="dash-table__empty">No hay solicitudes de material</td></tr> :
                                    pedidos.map((pedido) => (
                                        <tr key={pedido.id_pedido}>
                                            <td>#{pedido.id_pedido}{pedido.urgente && <span className="dash-badge-urgente"> URGENTE</span>}</td>
                                            <td><strong>{pedido.producto}</strong></td>
                                            <td>{pedido.departamento}<small style={{ display: 'block', opacity: 0.7 }}>{pedido.empresa}</small></td>
                                            <td>{pedido.stock_actual}</td><td>{pedido.stock_deseado}</td>
                                            <td>{pedido.estatus}</td>
                                            <td>
                                                {puedeGestionar && pedido.estatus === 'PENDIENTE' && (
                                                    <Link className="dash-btn-primary" to="/asignaciones" state={{ pedido }}>Asignar</Link>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                /* Table */
                <div className="dash-table-wrap">
                    <table className="dash-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                {!isUsuario && <th className="hide-on-mobile">Solicitante</th>}
                                <th>Departamento</th>
                                <th className="hide-on-mobile">Descripción</th>
                                <th className="hide-on-mobile">Fecha creación</th>
                                <th className="hide-on-mobile">Fecha solución</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={!isUsuario ? 8 : 7} className="dash-table__empty">
                                        <span className="dash-table__spinner" />
                                        Cargando tickets…
                                    </td>
                                </tr>
                            ) : ticketsMostrados.length === 0 ? (
                                <tr>
                                    <td colSpan={!isUsuario ? 8 : 7} className="dash-table__empty">
                                        {isUsuario ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                                <span>Aún no has enviado ningún ticket de soporte.</span>
                                                <Link to="/crear-ticket" className="dash-btn-primary" style={{ fontSize: '0.78rem' }}>
                                                    Crear mi primer ticket
                                                </Link>
                                            </div>
                                            ) : (
                                            'No hay tickets registrados'
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                ticketsMostrados.map((ticket) => {
                                    const est = ESTADOS[ticket.estado] || ESTADOS.PENDIENTE;
                                    return (
                                        <tr key={ticket.id_ticket}>
                                            <td className="dash-table__id">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span>#{ticket.id_ticket}</span>
                                                        {ticket.urgente && (
                                                            <span className="dash-badge-urgente" title="Ticket urgente">
                                                                URGENTE
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="show-on-mobile" style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.6)' }}>
                                                        {formatFecha(ticket.fecha_creacion)}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Columna solicitante para admins */}
                                            {!isUsuario && (
                                                <td className="hide-on-mobile">
                                                    <div style={{ fontWeight: 500, color: '#f1f5f9' }}>
                                                        {ticket.usuario_nombre || 'General'}
                                                    </div>
                                                    {ticket.usuario_correo && (
                                                        <div style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.6)' }}>
                                                            {ticket.usuario_correo}
                                                        </div>
                                                    )}
                                                </td>
                                            )}

                                            <td>
                                                <div style={{ fontWeight: 600, color: '#f1f5f9' }}>
                                                    {ticket.departamento || 'General'}
                                                </div>
                                                <div className="show-on-mobile" style={{ fontSize: '0.75rem', color: 'rgba(148,163,184,0.7)', marginTop: '2px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {ticket.descripcion}
                                                </div>
                                            </td>
                                            <td className="dash-table__desc hide-on-mobile">{ticket.descripcion}</td>
                                            <td className="hide-on-mobile">{formatFecha(ticket.fecha_creacion)}</td>
                                            <td className="hide-on-mobile">{formatFecha(ticket.fecha_solucion)}</td>
                                            <td>
                                                <span
                                                    className="dash-badge"
                                                    style={{ color: est.color, background: est.bg }}
                                                >
                                                    {est.label}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                    {isUsuario ? (
                                                        /* Usuario normal: Botón de detalles siempre visible */
                                                        <button
                                                            type="button"
                                                            className="dash-btn-detail dash-btn-detail--desktop"
                                                            onClick={() => setTicketDetalle(ticket)}
                                                            title="Ver detalles del ticket"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="12" cy="12" r="10" />
                                                                <line x1="12" y1="16" x2="12" y2="12" />
                                                                <line x1="12" y1="8" x2="12.01" y2="8" />
                                                            </svg>
                                                            <span>Ver Detalles</span>
                                                        </button>
                                                    ) : (
                                                        /* Admin/Gerente: Selector en desktop y botón en móvil */
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="dash-btn-detail show-on-mobile"
                                                                onClick={() => setTicketDetalle(ticket)}
                                                                title="Ver detalles completos del ticket"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <circle cx="12" cy="12" r="10" />
                                                                    <line x1="12" y1="16" x2="12" y2="12" />
                                                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                                                </svg>
                                                                <span>Detalles</span>
                                                            </button>

                                                            <select
                                                                className="dash-select hide-on-mobile"
                                                                value={ticket.estado}
                                                                onChange={(e) => cambiarEstado(ticket.id_ticket, e.target.value)}
                                                                disabled={updatingId === ticket.id_ticket}
                                                            >
                                                                {Object.entries(ESTADOS).map(([key, { label }]) => (
                                                                    <option key={key} value={key}>{label}</option>
                                                                ))}
                                                            </select>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                )}

                {/* ── Modal de Detalles de Ticket ── */}
                {ticketDetalle && (
                    <div className="dash-modal-overlay" onClick={() => setTicketDetalle(null)}>
                        <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="dash-modal__header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <h2 className="dash-modal__title">Ticket #{ticketDetalle.id_ticket}</h2>
                                    {ticketDetalle.urgente && (
                                        <span className="dash-badge-urgente">URGENTE</span>
                                    )}
                                    <span
                                        className="dash-badge"
                                        style={{
                                            color: ESTADOS[ticketDetalle.estado]?.color || '#f59e0b',
                                            background: ESTADOS[ticketDetalle.estado]?.bg || 'rgba(245,158,11,0.12)',
                                        }}
                                    >
                                        {ESTADOS[ticketDetalle.estado]?.label || ticketDetalle.estado}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="dash-modal__close"
                                    onClick={() => setTicketDetalle(null)}
                                    aria-label="Cerrar modal"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <div className="dash-modal__body">
                                {!isUsuario && ticketDetalle.usuario_nombre && (
                                    <div className="dash-detail-row">
                                        <span className="dash-detail-label">Solicitante</span>
                                        <span className="dash-detail-value">
                                            {ticketDetalle.usuario_nombre} {ticketDetalle.usuario_correo ? `(${ticketDetalle.usuario_correo})` : ''}
                                        </span>
                                    </div>
                                )}

                                <div className="dash-detail-row">
                                    <span className="dash-detail-label">Departamento</span>
                                    <span className="dash-detail-value">{ticketDetalle.departamento || 'General'}</span>
                                </div>

                                <div className="dash-detail-row">
                                    <span className="dash-detail-label">Fecha de Creación</span>
                                    <span className="dash-detail-value">{formatFecha(ticketDetalle.fecha_creacion)}</span>
                                </div>

                                <div className="dash-detail-row">
                                    <span className="dash-detail-label">Fecha de Solución</span>
                                    <span className="dash-detail-value">{formatFecha(ticketDetalle.fecha_solucion)}</span>
                                </div>

                                <div className="dash-detail-group">
                                    <span className="dash-detail-label">Descripción del Problema</span>
                                    <div className="dash-detail-box">
                                        {ticketDetalle.descripcion || 'Sin descripción'}
                                    </div>
                                </div>

                                {!isUsuario ? (
                                    /* Solo admin y gerente pueden cambiar el estado */
                                    <div className="dash-detail-group">
                                        <span className="dash-detail-label">Cambiar Estado</span>
                                        <select
                                            className="dash-select"
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                            value={ticketDetalle.estado}
                                            onChange={(e) => cambiarEstado(ticketDetalle.id_ticket, e.target.value)}
                                            disabled={updatingId === ticketDetalle.id_ticket}
                                        >
                                            {Object.entries(ESTADOS).map(([key, { label }]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="dash-detail-row">
                                        <span className="dash-detail-label">Estado Actual</span>
                                        <span
                                            className="dash-badge"
                                            style={{
                                                color: ESTADOS[ticketDetalle.estado]?.color || '#f59e0b',
                                                background: ESTADOS[ticketDetalle.estado]?.bg || 'rgba(245,158,11,0.12)',
                                            }}
                                        >
                                            {ESTADOS[ticketDetalle.estado]?.label || ticketDetalle.estado}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="dash-modal__footer">
                                <button
                                    type="button"
                                    className="dash-refresh"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() => setTicketDetalle(null)}
                                >
                                    Cerrar Detalles
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

export default Tickets;