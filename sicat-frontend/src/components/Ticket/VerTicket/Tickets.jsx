
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

const opciones = ['SOLUCIONADO', 'EN_PROCESO', 'PENDIENTE']

const ESTADOS_FECHA_LIMITE = {
    HOY: { label: 'Vence hoy', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    VENCIDO: { label: 'Vencido', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    EN_PLAZO: { label: 'En plazo', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    FUERA_DE_PLAZO: { label: 'Fuera de plazo', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

function Tickets() {
    const { usuario } = useAuth();
    const [userProfile, setUserProfile] = useState(null);
    const searchParams = useSearchParams()[0];

    
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

    const [departamento, setDepartamento] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({type: '', text: ''});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [activeTab, setActiveTab] = useState('tickets');
    const [pedidos, setPedidos] = useState([]);
    const [loadingPedidos, setLoadingPedidos] = useState(false);
    const [estadoFilter, setEstadoFilter] = useState(['ALL']);
    const [search, setSearch] = useState('');
    const [marcados, setMarcados] = useState([])
    const [checkListOpen, setCheckListOpen] = useState(false);
    const [fechasCreacionFilterOpen, setFechasCreacionFilterOpen] = useState(false)
    const [fechaDesdeCreacion, setFechaDesdeCreacion] = useState('');
    const [fechaHastaCreacion, setFechaHastaCreacion] = useState('');
    const [fechasSolucionFilterOpen, setFechasSolucionFilterOpen] = useState(false)
    const [fechaDesdeSolucion, setFechaDesdeSolucion] = useState('');
    const [fechaHastaSolucion, setFechaHastaSolucion] = useState('');
    const [opcionesFilterOpen, setOpcionesFilterOpen] = useState(false);
    const [departamentoFilter, setDepartamentoFilter] = useState('ALL');
// Modal de Detalles
    const [ticketDetalle, setTicketDetalle] = useState(null);
    

    const filtrosRef = useRef(null);

    const ticketRecibido = Number(searchParams.get('ticket'));

    

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!filtrosRef.current?.contains(event.target)) {
                setCheckListOpen(false);
                setOpcionesFilterOpen(false);
                setFechasCreacionFilterOpen(false);
                setFechasSolucionFilterOpen(false);
            }
        };

        document.addEventListener('pointerdown', handleOutsideClick);
        return () => document.removeEventListener('pointerdown', handleOutsideClick);
    }, []);

    

    // Cargar tickets
    useEffect(() => {
        if (!usuario) return undefined;

        fetchDepartamentos();
        fetchTickets();
        return subscribeToEvents((type) => {
            if (type.startsWith('ticket.')) fetchTickets();
            if (type.startsWith('material-request.')) fetchPedidos();
        });
    }, [usuario]);

    async function fetchDepartamentos() {
        setLoading(true);
        try {
            const { data } = await client.get('/departamentos');
            setDepartamento(Array.isArray(data) ? data : []);
        } catch (err) {
            setError('Error al cargar los departamentos');
        } finally {
            setLoading(false);
        }
    }

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


    const ticketsMostrados = useMemo(() => {
        const q = search.toLowerCase();
        const desdeCreacion = fechaDesdeCreacion ? new Date(`${fechaDesdeCreacion}T00:00:00`) : null;
        const hastaCreacion = fechaHastaCreacion ? new Date(`${fechaHastaCreacion}T23:59:59.999`) : null;
        const desdeSolucion = fechaDesdeSolucion ? new Date(`${fechaDesdeSolucion}T00:00:00`) : null;
        const hastaSolucion = fechaHastaSolucion ? new Date(`${fechaHastaSolucion}T23:59:59.999`) : null;

        const PRIORITY_ORDER = {
            PENDIENTE: 1,    
            EN_PROCESO: 2,   
            SOLUCIONADO: 3   
        };

        const estadosSeleccionados = estadoFilter.map((e) => String(e).toUpperCase()).filter((e) => e !== 'ALL');
        const filtrarPorEstado = estadosSeleccionados.length > 0;

        return tickets
        .filter((t) => {
            const matchesSearch =
                (t.descripcion || '').toLowerCase().includes(q) ||
                (t.departamento || '').toLowerCase().includes(q) ||
                (t.usuario_nombre || '').toLowerCase().includes(q) ||
                (t.usuario_correo || '').toLowerCase().includes(q) ||
                String(t.id_ticket || '').includes(q);

            if (!matchesSearch) return false;

            if (filtrarPorEstado && !estadosSeleccionados.includes(String(t.estado).toUpperCase())) return false;

            if (isUsuario && t.usuario_id !== usuario.id_usuario) return false;

            if (desdeCreacion || hastaCreacion) {
                const fechaCreacion = t.fecha_creacion ? new Date(t.fecha_creacion) : null;
                
                if (desdeCreacion && fechaCreacion < desdeCreacion) return false;
                if (hastaCreacion && fechaCreacion > hastaCreacion) return false;
            }

            if (desdeSolucion || hastaSolucion) {
                const fechaSolucion = t.fecha_solucion ? new Date(t.fecha_solucion) : null;
                if (desdeSolucion && fechaSolucion < desdeSolucion) return false;
                if (hastaSolucion && fechaSolucion > hastaSolucion) return false;
            }

            if (departamentoFilter && t.departamento !== departamentoFilter && departamentoFilter !== 'ALL') return false;

            return true;
        }).toSorted((a,b) => {
            const pesoA = PRIORITY_ORDER[a.estado] ?? 99;
            const pesoB = PRIORITY_ORDER[b.estado] ?? 99;
            return pesoA - pesoB;
        });
    }, [tickets, isUsuario, usuario, departamentoFilter, estadoFilter, search, fechaDesdeCreacion, fechaHastaCreacion, fechaDesdeSolucion, fechaHastaSolucion]);

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

    function formatFecha(fecha) {
        if (!fecha) return '—';
        return new Date(fecha).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }

    function estadoFechaLimite(ticket) {

        if (!ticket.fecha_limite) return null;

        const limite = new Date(ticket.fecha_limite);
        const hoy = new Date();

        //poner las horas a 0 para poder comparar solo la fecha
        limite.setHours(0, 0, 0, 0);
        hoy.setHours(0, 0, 0, 0);
        //se evalua si le fecha es el limite o ya vencio, con las horas ya normalizadas a 0 a.m
        if (limite.getTime() === hoy.getTime()) return ESTADOS_FECHA_LIMITE.HOY;
        if(limite < hoy) return ESTADOS_FECHA_LIMITE.VENCIDO;
        //si no es la fecha limite ni a vencido entonces se retorna que esta en plazo
        return ESTADOS_FECHA_LIMITE.EN_PLAZO;
    }

    const toggle = (opcion) => {
        setEstadoFilter((prev) =>
            prev.includes(opcion)
                ? prev.filter((o) => o !== opcion)
                : [...prev, opcion])
    };

    const limpiarFiltros = () => {
        setEstadoFilter(['ALL']);
        setSearch('');
        setFechaDesdeCreacion('');
        setFechaHastaCreacion('');
        setFechaDesdeSolucion('');
        setFechaHastaSolucion('');
        setCheckListOpen(false);
        setOpcionesFilterOpen(false);
        setFechasCreacionFilterOpen(false);
        setFechasSolucionFilterOpen(false);
        setDepartamentoFilter('ALL');
    }; 

    const ticketRecibidoDetalle = useCallback(() =>{
        const idTicket = ticketRecibido;
        const ticketD = tickets.find(t => Number(t.id_ticket) === Number(idTicket))
        setTicketDetalle(ticketD)
    }, [tickets, ticketRecibido])

    useEffect(()=>{
        ticketRecibidoDetalle()
    }, [ticketRecibidoDetalle])

    return (
        <Layout>
            <div className="dash-container">
                
                <div className="dash-header">
                    <div>
                        <div className="dash-header__title-container">
                            <div className="dash-header__icon">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M19 18.75H5C4.53668 18.7474 4.09309 18.5622 3.76546 18.2345C3.43784 17.9069 3.25263 17.4633 3.25 17V14.5C3.25259 14.3019 3.33244 14.1126 3.47253 13.9725C3.61263 13.8324 3.80189 13.7526 4 13.75C4.46413 13.75 4.90925 13.5656 5.23744 13.2374C5.56563 12.9092 5.75 12.4641 5.75 12C5.75 11.5359 5.56563 11.0908 5.23744 10.7626C4.90925 10.4344 4.46413 10.25 4 10.25C3.80189 10.2474 3.61263 10.1676 3.47253 10.0275C3.33244 9.88737 3.25259 9.69811 3.25 9.5V7C3.25263 6.53668 3.43784 6.09309 3.76546 5.76546C4.09309 5.43784 4.53668 5.25263 5 5.25H19C19.4633 5.25263 19.9069 5.43784 20.2345 5.76546C20.5622 6.09309 20.7474 6.53668 20.75 7V9.5C20.7474 9.69811 20.6676 9.88737 20.5275 10.0275C20.3874 10.1676 20.1981 10.2474 20 10.25C19.5359 10.25 19.0908 10.4344 18.7626 10.7626C18.4344 11.0908 18.25 11.5359 18.25 12C18.25 12.4641 18.4344 12.9092 18.7626 13.2374C19.0908 13.5656 19.5359 13.75 20 13.75C20.1981 13.7526 20.3874 13.8324 20.5275 13.9725C20.6676 14.1126 20.7474 14.3019 20.75 14.5V17C20.7474 17.4633 20.5622 17.9069 20.2345 18.2345C19.9069 18.5622 19.4633 18.7474 19 18.75ZM4.75 15.16V17C4.75 17.0663 4.77634 17.1299 4.82322 17.1768C4.87011 17.2237 4.9337 17.25 5 17.25H19C19.0663 17.25 19.1299 17.2237 19.1768 17.1768C19.2237 17.1299 19.25 17.0663 19.25 17V15.16C18.5403 14.9894 17.9088 14.5849 17.457 14.0117C17.0052 13.4385 16.7595 12.7299 16.7595 12C16.7595 11.2701 17.0052 10.5615 17.457 9.98829C17.9088 9.41505 18.5403 9.01057 19.25 8.84V7C19.25 6.9337 19.2237 6.87011 19.1768 6.82322C19.1299 6.77634 19.0663 6.75 19 6.75H5C4.9337 6.75 4.87011 6.77634 4.82322 6.82322C4.77634 6.87011 4.75 6.9337 4.75 7V8.84C5.45965 9.01057 6.09123 9.41505 6.54301 9.98829C6.99479 10.5615 7.24046 11.2701 7.24046 12C7.24046 12.7299 6.99479 13.4385 6.54301 14.0117C6.09123 14.5849 5.45965 14.9894 4.75 15.16Z" fill="currentColor"></path> </g></svg>
                            </div>
                            <h1 className="dash-header__title">
                                {isUsuario ? 'Mis Tickets' : 'Sistema de Tickets'}
                            </h1>
                        </div>
                        <p className="dash-header__subtitle">
                            {isUsuario
                                ? 'Consulta el estado y seguimiento de los tickets que has enviado'
                                : `Gestión de Tickets`}
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

                <div className="dash-stats">
                    {Object.entries(ESTADOS).map(([key, { label, color }]) => {
                        const count = ticketsMostrados.filter((t) => t.estado === key).length;
                        return (
                            <div key={key} className="dash-stat">
                                <span className="dash-stat__count" style={{ color }}>{count}</span>
                                <span className="dash-stat__label">{label}</span>
                            </div>

                        );
                    })}

                </div>

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
                <>
                    <div className="tickets-toolbar">

                        <div className="tickets-search">
                            <input
                                className="tickets-search-input"
                                placeholder='Buscar Por Departamento, Problema, Usuario, Etc'
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                type="text"
                            />
                        </div>
                        <div
                            ref={filtrosRef}
                            className={`tickets-filters ${checkListOpen || opcionesFilterOpen || fechasCreacionFilterOpen || fechasSolucionFilterOpen ? 'tickets-filters--open' : ''}`}
                        >
                            {(search || fechaDesdeCreacion || fechaHastaCreacion || fechaDesdeSolucion || fechaHastaSolucion || departamentoFilter !== 'ALL' || estadoFilter.length > 1) && (
                                <button
                                    className="tickets-btn tickets-btn--clear"
                                    onClick={limpiarFiltros}
                                    aria-label="Eliminar todos los filtros"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18" />
                                        <path d="M8 6V4h8v2" />
                                        <path d="M19 6l-1 14H6L5 6" />
                                        <path d="M10 11v5M14 11v5" />
                                    </svg>
                                    Limpiar filtros
                                </button>
                            )}

                            <div className="tickets-checklist">
                                <button
                                    className={"tickets-btn tickets-btn--checklist" + ((estadoFilter.length > 1) ? ' tickets-filter--active' : '')}
                                    onClick={() => {
                                        setCheckListOpen(!checkListOpen);
                                        setOpcionesFilterOpen(false);
                                        setFechasCreacionFilterOpen(false);
                                        setFechasSolucionFilterOpen(false);
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18M3 12h18M3 18h18" />
                                    </svg>
                                    Por estado
                                    {(estadoFilter.length > 1) && (
                                        <p>!</p>
                                    )}
                                </button>
                                {checkListOpen && (
                                    <div className="tickets-checklist-items">
                                        {opciones.map((opcion) => (
                                            <label key={opcion} className="checklist-item">
                                                <input
                                                    type="checkbox"
                                                    checked={estadoFilter.includes(opcion)}
                                                    onChange={() => toggle(opcion)}
                                                />
                                                {String(opcion).replace("_", " ")}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="tickets-date-filter">
                                <button
                                    className={"tickets-btn tickets-btn--filter" + ((fechaDesdeSolucion || fechaHastaSolucion || fechaDesdeCreacion || fechaHastaCreacion) ? ' tickets-filter--active' : '') + ((opcionesFilterOpen) ? ' tickets-filter--open' : '')}
                                    onClick={() => {
                                        setOpcionesFilterOpen(!opcionesFilterOpen);
                                        setCheckListOpen(false);
                                        setFechasCreacionFilterOpen(false);
                                        setFechasSolucionFilterOpen(false);
                                    }}
                                >
                                    <svg fill="currentColor" width="16px" height="16px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M28.106 19.944h-0.85c-0.069-0.019-0.131-0.050-0.2-0.063-1.788-0.275-3.2-1.762-3.319-3.506-0.137-1.95 0.975-3.6 2.787-4.137 0.238-0.069 0.488-0.119 0.731-0.181h0.85c0.056 0.019 0.106 0.050 0.169 0.056 1.65 0.269 2.906 1.456 3.262 3.081 0.025 0.125 0.063 0.25 0.094 0.375v0.85c-0.019 0.056-0.050 0.113-0.056 0.169-0.262 1.625-1.419 2.863-3.025 3.238-0.156 0.038-0.3 0.081-0.444 0.119zM4.081 12.056l0.85 0c0.069 0.019 0.131 0.050 0.2 0.056 1.8 0.281 3.206 1.775 3.319 3.537 0.125 1.944-1 3.588-2.819 4.119-0.231 0.069-0.469 0.119-0.7 0.175h-0.85c-0.056-0.019-0.106-0.050-0.162-0.063-1.625-0.3-2.688-1.244-3.194-2.819-0.069-0.206-0.106-0.425-0.162-0.637v-0.85c0.019-0.056 0.050-0.113 0.056-0.169 0.269-1.631 1.419-2.863 3.025-3.238 0.15-0.037 0.294-0.075 0.437-0.113zM15.669 12.056h0.85c0.069 0.019 0.131 0.050 0.2 0.063 1.794 0.281 3.238 1.831 3.313 3.581 0.087 1.969-1.1 3.637-2.931 4.106-0.194 0.050-0.387 0.094-0.581 0.137h-0.85c-0.069-0.019-0.131-0.050-0.2-0.063-1.794-0.275-3.238-1.831-3.319-3.581-0.094-1.969 1.1-3.637 2.931-4.106 0.2-0.050 0.394-0.094 0.588-0.137z"></path> </g></svg>
                                    Rango de fechas
                                    {(fechaDesdeSolucion || fechaHastaSolucion || fechaDesdeCreacion || fechaHastaCreacion) && (
                                        <p>!</p>
                                    )}
                                </button>
                                {opcionesFilterOpen && (
                                    <div className="tickets-date-options">
                                        <div className="tickets-date-filter--creation">
                                            <button
                                                className={'tickets-btn tickets-btn--date-filter' + ((fechaDesdeCreacion || fechaHastaCreacion) ? ' tickets-filter--active' : '')}
                                                onClick={() => {
                                                    setFechasCreacionFilterOpen(!fechasCreacionFilterOpen);
                                                }}
                                                aria-label="Filtrar por fecha de creación"
                                            >
                                                <svg width="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M3 9H21M17 13.0014L7 13M10.3333 17.0005L7 17M7 3V5M17 3V5M6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V8.2C21 7.07989 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
                                                Por fecha de creación
                                                {(fechaDesdeCreacion || fechaHastaCreacion) && (
                                                    <p>!</p>
                                                )}
                                            </button>
                                            {fechasCreacionFilterOpen && (
                                                <div className="tickets-date-filter-calendar">
                                                    <span>Desde: </span>
                                                    <input
                                                        type="date"
                                                        className="tickets-input-date tickets-date-from"
                                                        max={fechaHastaCreacion}
                                                        onChange={(e) => setFechaDesdeCreacion(e.target.value)}
                                                        value={fechaDesdeCreacion}
                                                    />
                                                    <span>Hasta: </span>
                                                    <input
                                                        type="date"
                                                        className="tickets-input-date tickets-date-to"
                                                        min={fechaDesdeCreacion}
                                                        onChange={(e) => setFechaHastaCreacion(e.target.value)}
                                                        value={fechaHastaCreacion}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="tickets-date-filter--solution">
                                            <button
                                                className={"tickets-btn tickets-btn--date-filter" + ((fechaDesdeSolucion || fechaHastaSolucion) ? ' tickets-filter--active' : '')}
                                                onClick={() => {
                                                    setFechasSolucionFilterOpen(!fechasSolucionFilterOpen);
                                                }}
                                                aria-label="Filtrar por fecha de solución"
                                            >
                                                <svg width="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M3 9H21M17 13.0014L7 13M10.3333 17.0005L7 17M7 3V5M17 3V5M6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V8.2C21 7.07989 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
                                                Por fecha de solución
                                                {(fechaDesdeSolucion || fechaHastaSolucion) && (
                                                    <p>!</p>
                                                )}
                                            </button>
                                            {fechasSolucionFilterOpen && (
                                                <div className="tickets-date-filter-calendar">
                                                    <span>Desde: </span>
                                                    <input
                                                        type="date"
                                                        className="tickets-input-date tickets-date-from"
                                                        max={fechaHastaSolucion}
                                                        onChange={(e) => setFechaDesdeSolucion(e.target.value)}
                                                        value={fechaDesdeSolucion}
                                                    />
                                                    <span>Hasta:</span>
                                                    <input
                                                        type="date"
                                                        className="tickets-input-date tickets-date-to"
                                                        min={fechaDesdeSolucion}
                                                        onChange={(e) => setFechaHastaSolucion(e.target.value)}
                                                        value={fechaHastaSolucion}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <select value={departamentoFilter} onChange={(e) => setDepartamentoFilter(e.target.value)} className="tickets-select">
                                <option value="ALL">Todos los departamentos</option>
                                {departamento.map((d) => (
                                    <option key={d.id_departamento} value={d.departamento}>
                                        {d.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </>

                {loading ? (
                    <>
                        <div className="dash-table__spinner" />
                        Cargando tickets…
                    </>
                ) : ticketsMostrados.length === 0 ? (
                    <>
                        {isUsuario ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                <span>Aún no has enviado ningún ticket de soporte.</span>
                            </div>
                        ) : (
                            'No hay tickets registrados'
                        )}
                    </>
                ) : (
                    <div className="dash-table-wrap">
                        <table className="dash-table">
                            <thead>
                                <tr>
                                    <th className="hide-on-mobile" >ID</th>
                                    {!isUsuario && <th>Solicitante</th>}
                                    <th>Departamento</th>
                                    <th style={{ textAlign: "center" }}>Descripción</th>
                                    <th className="hide-on-mobile">Fecha creación</th>
                                    <th className="hide-on-mobile">Fecha solución</th>
                                    <th className="hide-on-mobile">Fecha límite</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(
                                        ticketsMostrados.map((ticket) => {
                                        const est = ESTADOS[ticket.estado] || ESTADOS.PENDIENTE;
                                        const fechaEstado = estadoFechaLimite(ticket);
                                        return (
                                            <tr key={ticket.id_ticket}>
                                                <td className="dash-table__id hide-on-mobile">
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span>#{ticket.id_ticket}</span>

                                                        </div>
                                                        <span className="show-on-mobile" style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.6)' }}>
                                                            {formatFecha(ticket.fecha_creacion)}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Columna solicitante para admins */}
                                                {!isUsuario && (
                                                    <td>
                                                        <div style={{ fontWeight: 500, color: '#f1f5f9' }}>
                                                            {ticket.usuario_nombre || 'General'}
                                                        </div>
                                                        {ticket.usuario_correo && (
                                                            <div style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.6)' }}>
                                                                {ticket.usuario_correo}
                                                            </div>
                                                        )}
                                                        {ticket.urgente && (
                                                            <span className="dash-badge-urgente" title="Ticket urgente">
                                                                URGENTE
                                                            </span>
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
                                                <td className="dash-table__desc" style={{ overflow: 'hidden',  whiteSpace: 'initial' }}>
                                                    {ticket.descripcion}
                                                </td>
                                                <td className="hide-on-mobile">{formatFecha(ticket.fecha_creacion)}</td>
                                                <td className="hide-on-mobile">{formatFecha(ticket.fecha_solucion)}</td>
                                                <td className="hide-on-mobile">
                                                    <div>{formatFecha(ticket.fecha_limite)}</div>
                                                    {fechaEstado && (
                                                        <span
                                                            className="dash-badge"
                                                            style={{ color: fechaEstado.color, background: fechaEstado.bg, marginTop: '0.25rem' }}
                                                        >
                                                            {fechaEstado.label}
                                                        </span>
                                                    )}
                                                </td>
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

                    </div>)}


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
                                    {estadoFechaLimite(ticketDetalle) && (
                                        <span
                                            className="dash-badge"
                                            style={{
                                                color: estadoFechaLimite(ticketDetalle).color,
                                                background: estadoFechaLimite(ticketDetalle).bg,
                                            }}
                                        >
                                            {estadoFechaLimite(ticketDetalle).label}
                                        </span>
                                    )}
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

                                <div className="dash-detail-row">
                                    <span className="dash-detail-label">Fecha límite</span>
                                    <span className="dash-detail-value">
                                        {formatFecha(ticketDetalle.fecha_limite)}
                                        {estadoFechaLimite(ticketDetalle) && (
                                            <span
                                                className="dash-badge"
                                                style={{
                                                    color: estadoFechaLimite(ticketDetalle).color,
                                                    background: estadoFechaLimite(ticketDetalle).bg,
                                                    marginLeft: '0.5rem',
                                                }}
                                            >
                                                {estadoFechaLimite(ticketDetalle).label}

                                            </span>
                                        )}
                                    </span>
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