// src/components/inicio/Inicio.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import './Inicio.css';

// ── Iconos SVG compactos ──
const icons = {
    pending: (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
                <path d="M13.995 1.827a1.745 1.745 0 0 0-2.969 0l-9.8 17.742a1.603 1.603 0 0 0 0 1.656 1.678 1.678 0 0 0 1.48.775H22.28a1.68 1.68 0 0 0 1.484-.775 1.608 1.608 0 0 0 .003-1.656zM12 8h1v7h-1zm.5 10.5a1 1 0 1 1 1-1 1.002 1.002 0 0 1-1 1z"></path>
                <path fill="none" d="M0 0h24v24H0z"></path>
            </g>
        </svg>),
    users: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
    alert: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    ),
    ticket: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
        </svg>
    ),
    cart: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
    ),
    warehouse: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
            <path d="M6 18h12" /><path d="M6 14h12" />
        </svg>
    ),
    assign: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
        </svg>
    ),
    plus: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    ),
    check: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
        </svg>
    ),
    clock: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    arrowRight: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
};

function Inicio() {
    const { usuario } = useAuth();
    const navigate = useNavigate();
    const rol = (usuario?.rol || 'usuario').toLowerCase();

    const [cargando, setCargando] = useState(true);

    // Estados simplificados
    const [tickets, setTickets] = useState([]);
    const [alertasStock, setAlertasStock] = useState([]);
    const [pedido, setPedido] = useState([]);

    const formatFecha = (str) => {
        if (!str) return '—';
        try {
            return new Date(str).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        } catch {
            return str;
        }
    };

    const cargarDatos = useCallback(async () => {
        setCargando(true);
        try {
            if (rol === 'admin') {
                const [resAlertas, resTickets, resPedidos] = await Promise.allSettled([
                    client.get('/inventario/alertas'),
                    client.get('/tickets'),
                    client.get('/pedidos')

                 ]);

                
                if (resAlertas.status === 'fulfilled' && Array.isArray(resAlertas.value.data)) {
                    setAlertasStock(resAlertas.value.data);
                }
                if (resTickets.status === 'fulfilled' && Array.isArray(resTickets.value.data)) {
                    setTickets(resTickets.value.data);
                }
                if (resPedidos.status === 'fulfilled' && Array.isArray(resPedidos.value.data)) {
                    setPedido(resPedidos.value.data);
                }
            } else if (rol === 'gerente') {
                const [resAlertas, resPedidos, resTickets] = await Promise.allSettled([
                    client.get('/inventario/alertas'),
                    client.get('/pedidos'),
                    client.get('/tickets'),
                ]);

                if (resAlertas.status === 'fulfilled' && Array.isArray(resAlertas.value.data)) {
                    setAlertasStock(resAlertas.value.data);
                }
                if (resPedidos.status === 'fulfilled' && Array.isArray(resPedidos.value.data)) {
                    setPedido(resPedidos.value.data);
                }
                if (resTickets.status === 'fulfilled' && Array.isArray(resTickets.value.data)) {
                    setTickets(resTickets.value.data);
                }
            } else {
                // usuario
                const res = await client.get('/tickets');
                if (Array.isArray(res.data)) {
                    setTickets(res.data);
                }
            }
        } catch (err) {
            console.error('Error cargando datos del dashboard:', err);
        } finally {
            setCargando(false);
        }
    }, [rol]);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    const ticketsPendientes = useMemo(() => {
        return tickets.filter(t => t.estado !== 'SOLUCIONADO' && t.estado !== 'NULL');
    }, [tickets]);

    const ticketsResueltos = useMemo(() => {
        return tickets.filter(t => t.estado === 'SOLUCIONADO');
    }, [tickets]);

    const asignacionesPendientes = useMemo(() => {
        return pedido.filter(p => p.estatus === 'PENDIENTE');
    }, [pedido]);
    
    const badgeRol = {
        admin: 'Administrador',
        gerente: 'Gerente',
        usuario: 'Usuario'
    }[rol] || 'Usuario';

    return (
        <Layout>
            <div className="simple-dash">
                
                <header className="simple-header">
                    <div>
                        <h1 className="simple-title">
                            Hola, {usuario?.nombre?.split(' ')[0] || 'Usuario'}
                        </h1>
                        <p className="simple-subtitle">
                             <span className={`simple-role-tag simple-role-tag--${rol}`}>{badgeRol}</span>
                        </p>
                    </div>

                    {rol === 'usuario' && (
                        <button
                            className="simple-btn simple-btn--primary"
                            onClick={() => navigate('/crear-ticket')}
                        >
                            <span className="simple-btn__icon">{icons.plus}</span>
                            <span>Nuevo Ticket</span>
                        </button>
                    )}
                </header>
                {/*
                    1. ROL: ADMIN
                */}
                {rol === 'admin' && (
                    <div className="simple-view">
                        {/* KPIs Principales */}
                        <div className="simple-kpis">
                            {usuario?.id_departamento === 1 &&<div className="simple-kpi" onClick={() => navigate('/tickets')}>
                                <div className="simple-kpi__icon simple-kpi__icon--amber">{icons.ticket}</div>
                                <div className="simple-kpi__info">
                                    <span className="simple-kpi__num">{cargando ? '—' : ticketsPendientes.length}</span>
                                    <span className="simple-kpi__label">Tickets por Atender</span>
                                </div>
                            </div>
                            }

                            <div className="simple-kpi" onClick={() => navigate('/inventario')}>
                                <div className="simple-kpi__icon simple-kpi__icon--red">{icons.alert}</div>
                                <div className="simple-kpi__info">
                                    <span className="simple-kpi__num">{cargando ? '—' : alertasStock.length}</span>
                                    <span className="simple-kpi__label">Stock Bajo</span>
                                </div>
                            </div>

                            <div className="simple-kpi" onClick={() => navigate('/asignaciones')}>
                                <div className="simple-kpi__icon simple-kpi__icon--red">{icons.pending}</div>
                                <div className="simple-kpi__info">
                                    <span className="simple-kpi__num">{cargando ? '—' : asignacionesPendientes.length}</span>
                                    <span className="simple-kpi__label">Asignaciones Pendientes</span>
                                </div>
                            </div>

                        </div>
                        {/*
                        Atajos admin
                        */}
                        <div className="simple-shortcuts">
                            <button className="simple-shortcut" onClick={() => navigate('/crear-ticket')}>
                                <span className="simple-shortcut__icon">{icons.plus}</span>
                                <span>Crear Ticket</span>
                            </button>
                            <button className="simple-shortcut" onClick={() => navigate('/compras')}>
                                <span className="simple-shortcut__icon">{icons.cart}</span>
                                <span>Registrar Compra</span>
                            </button>
                            <button className="simple-shortcut" onClick={() => navigate('/inventario')}>
                                <span className="simple-shortcut__icon">{icons.warehouse}</span>
                                <span>Inventario</span>
                            </button>
                            <button className="simple-shortcut" onClick={() => navigate('/usuarios')}>
                                <span className="simple-shortcut__icon">{icons.users}</span>
                                <span>Usuarios</span>
                            </button>
                        </div>

                        {/*
                        Tickets que requieren atención
                        */}
                        {ticketsPendientes.length > 0 && (
                        <div className="simple-box">
                            <div className="simple-box__header">
                                <h3>Tickets Pendientes ({ticketsPendientes.length})</h3>
                                <button className="simple-box__link" onClick={() => navigate('/tickets')}>
                                    Ver todos {icons.arrowRight}
                                </button>
                            </div>
                            <div className="simple-list">
                                {
                                    ticketsPendientes.slice(0, 5).map(t => (
                                        <div
                                            key={t.id_ticket}
                                            className="simple-item"
                                            onClick={() => navigate('/tickets')}
                                        >
                                            <div className="simple-item__left">
                                                <span className="simple-item__id">#{t.id_ticket}</span>
                                                <div className="simple-item__meta">
                                                    <span className="simple-item__title">{t.descripcion}</span>
                                                    <span className="simple-item__sub">{t.usuario_nombre || 'Usuario'} • {t.departamento || 'General'}</span>
                                                </div>
                                            </div>
                                            <div className="simple-item__right">
                                                {t.urgente && <span className="simple-badge simple-badge--urgent">Urgente</span>}
                                                <span className={`simple-badge simple-badge--${t.estado?.toLowerCase()}`}>
                                                    {t.estado}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>)}

                        {/*
                        inventario bajo
                        */}
                        {alertasStock.length > 0 && (
                            <>
                        <div style={{padding: 20}}/>
                        <div className="simple-box">
                            <div className="simple-box__header">
                                <h3>Inventario Bajo ({alertasStock.length})</h3>
                                <button className="simple-box__link" onClick={() => navigate('/inventario')}>
                                    Ver todos {icons.arrowRight}
                                </button>
                            </div>

                            <div className="simple-list">
                                {
                                    alertasStock.slice(0, 5).map(i => (
                                        <div
                                            key={i.id_inventario}
                                            className="simple-item"
                                            onClick={() => navigate('/inventario')}
                                        >
                                            <div className="simple-item__left">
                                                <span className="simple-item__id">#{i.id_producto}</span>
                                                <div className="simple-item__meta">
                                                   <span className="simple-item__title">{i.producto}</span>
                                                    <span className="simple-item__sub"></span>
                                                </div>
                                            </div>
                                            <div className="simple-item__right">
                                                <div className="simple-item__stocks">
                                                    <div className="simple-item__meta">
                                                        <span className="simple-item-inv__title">Stock Disponible</span>
                                                        <span className="simple-item-inv__sub">{i.cantidad_disponible}</span>
                                                    </div>
                                                    <div className="simple-item__meta">
                                                        <span className="simple-item-inv__title">Stock Mínimo</span>
                                                        <span className="simple-item-inv__sub">{i.cantidad_minima}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                        </>)}

                        {/*
                        Asignaciones pendientes
                        */}
                        {asignacionesPendientes.length > 0 && (
                            <div className="simple-box">
                            <div className="simple-box__header">
                                <h3>Pedidos Pendientes ({asignacionesPendientes.length})</h3>
                                <button className="simple-box__link" onClick={() => navigate('/asignaciones')}>
                                    Ver todos {icons.arrowRight}
                                </button>

                            </div>
                            <div className="simple-list">
                                {
                                    asignacionesPendientes.slice(0, 5).map(p => (
                                        
                                        <div
                                            key={p.id_pedido}
                                            className="simple-item"
                                            onClick={() => navigate('/asignaciones')}
                                        >
                                            <div className="simple-item__left">
                                                <span className="simple-item__id">#{p.id_pedido}</span>
                                                <div className="simple-item__meta">
                                                    <span className="simple-item__title">{p.descripcion_material}</span>
                                                    <span className="simple-item__sub"> </span>
                                                </div>
                                            </div>
                                            <div className="simple-item__right">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                                                </svg>
                                                <span className="simple-item__title">
                                                     {p.departamento || 'General'}
                                                     </span>

                                                
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                        )}
                        {ticketsPendientes.length === 0 && alertasStock.length === 0 && asignacionesPendientes.length === 0 && (
                            <div className= 'simple-box__header'>
                                <div style={{padding: 20, textAlign: 'center'}}>
                                <span><strong>Nada que mostrar</strong></span>
                                </div>
                            </div>
                        )}

                    </div>
                )}
                {/*
                    2. ROL: GERENTE
                */}
                {rol === 'gerente' && (
                    <div className="simple-view">
                        {/* KPIs Principales */}
                        <div className="simple-kpis">
                            <div className="simple-kpi" onClick={() => navigate('/inventario')}>
                                <div className="simple-kpi__icon simple-kpi__icon--red">{icons.alert}</div>
                                <div className="simple-kpi__info">
                                    <span className="simple-kpi__num">{cargando ? '—' : alertasStock.length}</span>
                                    <span className="simple-kpi__label">Alertas de Stock</span>
                                </div>
                            </div>

                            <div className="simple-kpi" onClick={() => navigate('/asignaciones')}>
                                <div className="simple-kpi__icon simple-kpi__icon--purple">{icons.assign}</div>
                                <div className="simple-kpi__info">
                                    <span className="simple-kpi__num">{cargando ? '—' : pedido.length}</span>
                                    <span className="simple-kpi__label">Préstamos Activos</span>
                                </div>
                            </div>

                            <div className="simple-kpi" onClick={() => navigate('/tickets')}>
                                <div className="simple-kpi__icon simple-kpi__icon--amber">{icons.ticket}</div>
                                <div className="simple-kpi__info">
                                    <span className="simple-kpi__num">{cargando ? '—' : ticketsPendientes.length}</span>
                                    <span className="simple-kpi__label">Tickets Operativos</span>
                                </div>
                            </div>
                        </div>


                        <div className="simple-shortcuts">
                            <button className="simple-shortcut" onClick={() => navigate('/compras')}>
                                <span className="simple-shortcut__icon">{icons.cart}</span>
                                <span>Nueva Compra</span>
                            </button>
                            <button className="simple-shortcut" onClick={() => navigate('/asignaciones')}>
                                <span className="simple-shortcut__icon">{icons.assign}</span>
                                <span>Asignar / Prestar</span>
                            </button>
                            <button className="simple-shortcut" onClick={() => navigate('/inventario')}>
                                <span className="simple-shortcut__icon">{icons.warehouse}</span>
                                <span>Ver Inventario</span>
                            </button>
                            <button className="simple-shortcut" onClick={() => navigate('/tickets')}>
                                <span className="simple-shortcut__icon">{icons.ticket}</span>
                                <span>Revisar Tickets</span>
                            </button>
                        </div>
                        
                    </div>
                )}
                {/* 
                    3. ROL: USUARIO 
                 */}
                {rol === 'usuario' && (
                    <div className="simple-view">
                        {/* KPIs Usuario */}
                        <div className="simple-kpis simple-kpis--2">
                            <div className="simple-kpi" onClick={() => navigate('/tickets')}>
                                <div className="simple-kpi__icon simple-kpi__icon--amber">{icons.clock}</div>
                                <div className="simple-kpi__info">
                                    <span className="simple-kpi__num">{cargando ? '—' : ticketsPendientes.length}</span>
                                    <span className="simple-kpi__label">Mis Solicitudes Activas</span>
                                </div>
                            </div>

                            <div className="simple-kpi" onClick={() => navigate('/tickets')}>
                                <div className="simple-kpi__icon simple-kpi__icon--emerald">{icons.check}</div>
                                <div className="simple-kpi__info">
                                    <span className="simple-kpi__num">{cargando ? '—' : ticketsResueltos.length}</span>
                                    <span className="simple-kpi__label">Tickets Resueltos</span>
                                </div>
                            </div>
                        </div>

                        {/* Atajos Usuario */}
                        <div className="simple-shortcuts simple-shortcuts--2">
                            <button className="simple-shortcut simple-shortcut--primary" onClick={() => navigate('/crear-ticket')}>
                                <span className="simple-shortcut__icon">{icons.ticket}</span>
                                <span>Reportar Falla / Solicitar Soporte</span>
                            </button>
                            <button className="simple-shortcut" onClick={() => navigate('/solicitar-material')}>
                                <span className="simple-shortcut__icon">{icons.plus}</span>
                                <span>Solicitar Material</span>
                            </button>
                        </div>

                        {/*Tickets Recientes Usuario */}
                        <div className="simple-box">
                            <div className="simple-box__header">
                                <h3>Tickets abiertos</h3>
                                <button className="simple-box__link" onClick={() => navigate('/tickets')}>
                                    Todos los tickets {icons.arrowRight}
                                </button>
                            </div>
                            <div className="simple-list">
                                {tickets.length === 0 ? (
                                    <div className="simple-empty">
                                        <p>No tienes ningún ticket de soporte activo.</p>
                                        <button
                                            className="simple-btn simple-btn--primary"
                                            style={{ marginTop: '0.6rem' }}
                                            onClick={() => navigate('/crear-ticket')}
                                        >
                                            Crear Ticket
                                        </button>
                                    </div>
                                ) : (
                                    ticketsPendientes.slice(0, 5).map(t => (
                                        <div
                                            key={t.id_ticket}
                                            className="simple-item"
                                            onClick={() => navigate('/tickets')}
                                        >
                                            <div className="simple-item__left">
                                                <span className="simple-item__id">#{t.id_ticket}</span>
                                                <div className="simple-item__meta">
                                                    <span className="simple-item__title">{t.descripcion}</span>
                                                    <span className="simple-item__sub">{formatFecha(t.fecha_creacion)}</span>
                                                </div>
                                            </div>
                                            <div className="simple-item__right">
                                                {t.urgente && <span className="simple-badge simple-badge--urgent">Urgente</span>}
                                                <span className={`simple-badge simple-badge--${t.estado?.toLowerCase()}`}>
                                                    {t.estado}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

export default Inicio;