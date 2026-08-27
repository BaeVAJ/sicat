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
    const [updatingId, setUpdatingId] = useState(null);

    // Cargar tickets
    useEffect(() => {
        fetchTickets();
    }, []);

    async function fetchTickets() {
        setLoading(true);
        setError('');
        try {
            const { data } = await client.get('/tickets');
            setTickets(data);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cargar los tickets');
        } finally {
            setLoading(false);
        }
    }

    // Cambiar estado de un ticket
    async function cambiarEstado(id, nuevoEstado) {
        setUpdatingId(id);
        try {
            const body = { estado: nuevoEstado };
            if (nuevoEstado === 'SOLUCIONADO') {
                body.fecha_solucion = new Date().toISOString().split('T')[0];
            }
            const { data } = await client.patch(`/tickets/${id}/estado`, body);
            setTickets((prev) =>
                prev.map((t) => (t.id_ticket === id ? { ...t, ...data } : t))
            );
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
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'dash-refresh__spin' : ''}>
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                        <span>Actualizar</span>
                    </button>
                </div>

                {/* Stats */}
                <div className="dash-stats">
                    {Object.entries(ESTADOS).map(([key, { label, color, bg }]) => {
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

                {/* Error */}
                {error && (
                    <div className="dash-error">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {/* Table */}
                <div className="dash-table-wrap">
                    <table className="dash-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Departamento</th>
                                <th>Descripción</th>
                                <th>Fecha creación</th>
                                <th>Fecha solución</th>
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
                                            <td className="dash-table__id">#{ticket.id_ticket}</td>
                                            <td>{ticket.departamento || '—'}</td>
                                            <td className="dash-table__desc">{ticket.descripcion}</td>
                                            <td>{formatFecha(ticket.fecha_creacion)}</td>
                                            <td>{formatFecha(ticket.fecha_solucion)}</td>
                                            <td>
                                                <span
                                                    className="dash-badge"
                                                    style={{ color: est.color, background: est.bg }}
                                                >
                                                    {est.label}
                                                </span>
                                            </td>
                                            <td>
                                                <select
                                                    className="dash-select"
                                                    value={ticket.estado}
                                                    onChange={(e) => cambiarEstado(ticket.id_ticket, e.target.value)}
                                                    disabled={updatingId === ticket.id_ticket}
                                                >
                                                    {Object.entries(ESTADOS).map(([key, { label }]) => (
                                                        <option key={key} value={key}>{label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
}

export default Tickets;