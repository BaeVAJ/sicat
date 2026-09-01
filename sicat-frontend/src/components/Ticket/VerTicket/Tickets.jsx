// src/components/Ticket/VerTicket/Tickets.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import Layout from '../../layout/Layout';
import './Tickets.css';

const ESTADOS = {
    PENDIENTE: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    EN_PROCESO: { label: 'En proceso', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    SOLUCIONADO: { label: 'Solucionado', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

function Tickets() {
    const { usuario } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [updatingId, setUpdatingId] = useState(null);

    // Modal de Detalles
    const [ticketDetalle, setTicketDetalle] = useState(null);

    // Cargar tickets
    useEffect(() => {
        fetchTickets();
    }, []);

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

    // Cambiar estado de un ticket
    async function cambiarEstado(id, nuevoEstado) {
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
                        <h1 className="dash-header__title">Sistema de Tickets</h1>
                        <p className="dash-header__subtitle">
                            Bienvenido, {usuario?.nombre}
                        </p>
                    </div>
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
                </div>

                {/* Stats */}
                <div className="dash-stats">
                    {Object.entries(ESTADOS).map(([key, { label, color }]) => {
                        const count = tickets.filter((t) => t.estado === key).length;
                        return (
                            <div key={key} className="dash-stat" style={{ borderColor: color }}>
                                <span className="dash-stat__count" style={{ color }}>{count}</span>
                                <span className="dash-stat__label">{label}</span>
                            </div>
                        );
                    })}
                    <div className="dash-stat" style={{ borderColor: '#94a3b8' }}>
                        <span className="dash-stat__count" style={{ color: '#f1f5f9' }}>{tickets.length}</span>
                        <span className="dash-stat__label">Total</span>
                    </div>
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

                {/* Table */}
                <div className="dash-table-wrap">
                    <table className="dash-table">
                        <thead>
                            <tr>
                                <th>ID</th>
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
                                    <td colSpan="7" className="dash-table__empty">
                                        <span className="dash-table__spinner" />
                                        Cargando tickets…
                                    </td>
                                </tr>
                            ) : tickets.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="dash-table__empty">
                                        No hay tickets registrados
                                    </td>
                                </tr>
                            ) : (
                                tickets.map((ticket) => {
                                    const est = ESTADOS[ticket.estado] || ESTADOS.PENDIENTE;
                                    return (
                                        <tr key={ticket.id_ticket}>
                                            <td className="dash-table__id">
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span>#{ticket.id_ticket}</span>
                                                    <span className="show-on-mobile" style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.6)' }}>
                                                        {formatFecha(ticket.fecha_creacion)}
                                                    </span>
                                                </div>
                                            </td>
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
                                                    {/* Botón de Detalles para abrir modal completo (solo en móvil) */}
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

                                                    {/* Selector de estado visible en desktop */}
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
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Modal de Detalles de Ticket ── */}
                {ticketDetalle && (
                    <div className="dash-modal-overlay" onClick={() => setTicketDetalle(null)}>
                        <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="dash-modal__header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h2 className="dash-modal__title">Ticket #{ticketDetalle.id_ticket}</h2>
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