import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import { subscribeToEvents } from '../../../api/events';
import Layout from '../../layout/Layout';
import './Asignaciones.css';

function SortHeader({ label, sortKey, sort, onSort, className }) {
    const active = sort.key === sortKey;
    const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return (
        <th aria-sort={ariaSort} className={className}>
            <button type="button" className="complementos-sort" onClick={() => onSort(sortKey)}>
                {label}
                <span className="complementos-sort__arrow" aria-hidden="true">
                    {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                </span>
            </button>
        </th>
    );
}

function Asignaciones() {
    const { usuario } = useAuth();
    const location = useLocation();
    const searchParams = useSearchParams()[0];

    const [asignaciones, setAsignaciones] = useState([]);
    const [inventario, setInventario] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [pedidos, setPedidos] = useState([]);
    const [pedidoInventario, setPedidoInventario] = useState({});
    const [pedidoLoading, setPedidoLoading] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [activeTab, setActiveTab] = useState('asignaciones'); 
    const [search, setSearch] = useState('');
    const [filterEstatus, setFilterEstatus] = useState('ALL');
    const [filterDepto, setFilterDepto] = useState('ALL');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [formIdInventario, setFormIdInventario] = useState('');
    const [formIdDepartamento, setFormIdDepartamento] = useState('');
    const [formCondicion, setFormCondicion] = useState('Excelente');
    const [formEsDevolvible, setFormEsDevolvible] = useState(false);

    const [returnItem, setReturnItem] = useState(null);
    const [returnCondicion, setReturnCondicion] = useState('');

    const isAdmin = usuario?.rol === 'admin';
    const isGerente = usuario?.rol === 'gerente';
    const canManage = isAdmin || isGerente || usuario?.id_departamento === 1;

    const [message, setMessage] = useState({type: '', text: ''});

    const [sort, setSort] = useState({ key: 'id', dir: 'desc' });

    const showMessage = useCallback((type, text) => {
        setMessage({ type, text});
    })
    
    useEffect(() => {
        fetchData();
        return subscribeToEvents((type) => {
            if (type.startsWith('material-request.') || type.startsWith('assignment.') || type.startsWith('inventory.')) {
                fetchData();
            }
        });
    }, []);

    useEffect(() => {
        const pedido = location.state?.pedido;
        if (!pedido || inventario.length === 0 || departamentos.length === 0) return;
        const inv = inventario.find((item) => String(item.id_producto) === String(pedido.id_producto) && Number(item.cantidad_disponible) > 0);
        queueMicrotask(() => {
            setFormIdInventario(inv ? String(inv.id_inventario) : '');
            setFormIdDepartamento(String(pedido.id_departamento || ''));
            setFormCondicion(`Solicitud #${pedido.id_pedido}`);
            showMessage(inv ? ('','') :  ('error', 'La solicitud no tiene stock disponible para asignar.'))
            setCreateModalOpen(true);
        });
    }, [location.state, inventario, departamentos]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        queueMicrotask(() => {
            setActiveTab(tab === 'solicitudes' ? 'solicitudes' : 'asignaciones');
        });
    }, [searchParams]);

    async function fetchData() {
        setLoading(true);   
        try {
            const [asigRes, invRes, deptRes, pedidosRes] = await Promise.all([
                client.get('/asignaciones'),
                client.get('/inventario').catch(() => ({ data: [] })),
                client.get('/departamentos').catch(() => ({ data: [] })),
                client.get('/pedidos'),
            ]);
            setAsignaciones(Array.isArray(asigRes.data) ? asigRes.data : []);
            setInventario(Array.isArray(invRes.data) ? invRes.data : []);
            setDepartamentos(Array.isArray(deptRes.data) ? deptRes.data : []);
            setPedidos(Array.isArray(pedidosRes.data) ? pedidosRes.data : []);
        } catch (err) {
            const status = err.response?.status;
            const serverError = err.response?.data?.error;
            const errorText = typeof serverError === 'string' ? serverError : '';
            let message = 'Error cargar los productos.';

            if (!err.response) {
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (errorText.includes('getaddrinfo')) {
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if (isAdmin) {
                message += ` [${status ?? err.code} | ${errorText || err.message}]`;
            }
            showMessage('error', message);
        } finally {
            setLoading(false);
        }
    }

    const toggleSort = useCallback((key) => {
        setSort((prev) =>
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: key === 'empresa' ? 'asc' : 'desc' }
        );
    }, []);

    function normalizar(texto) {
        return String(texto ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function valorOrden(item, key) {
        switch (key) {
            case 'id':
                return item.id_asignacion;
            case 'producto':
                return normalizar(item.producto);
            case 'departamento':
                return normalizar(item.departamento);
            case 'fecha_asignacion':
                return normalizar(item.fecha_asignacion);
            case 'estado':
                return normalizar(item.estatus);
            case'condicion':
                return normalizar(item.condicion);
            case 'fecha_devolucion':
                return normalizar(item.fecha_devolucion);
            default:
                return item[key] ?? null;
        }
    }

    const filteredAsignaciones = useMemo(() => {
        const lista = asignaciones.filter((item) => {
            const matchesSearch =
                (item.producto || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.marca || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.departamento || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.condicion || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.estatus || '').toLowerCase().includes(search.toLowerCase()) ||
                String(item.id_asignacion || '').includes(search);

            const matchesEstatus = filterEstatus === 'ALL' || item.estatus === filterEstatus;
            const matchesDepto = filterDepto === 'ALL' || String(item.id_departamento) === String(filterDepto);

            if (filterEstatus === 'NO_DEVOLVIBLE') {
                return item.es_devolvible === false && matchesSearch && matchesDepto;
            }
            if (filterEstatus === 'ACTIVO') {
                return matchesEstatus && item.es_devolvible === true && matchesSearch && matchesDepto;
            }
            return matchesSearch && matchesEstatus && matchesDepto;
        });
        const factor = sort.dir === 'asc' ? 1 : -1;
        return [...lista].sort((a, b) => {
            const va = valorOrden(a, sort.key);
            const vb = valorOrden(b, sort.key);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (va < vb) return -1 * factor;
            if (va > vb) return 1 * factor;
            return 0;
        });
    }, [asignaciones, search, filterEstatus, filterDepto, sort]);

    const availableInventory = useMemo(
        () => inventario.filter((inv) => Number(inv.id_departamento) === 1),
        [inventario]
    );

    const pendingPedidos = useMemo(
        () => pedidos.filter((pedido) => pedido.estatus === 'PENDIENTE'),
        [pedidos]
    );

    async function asignarPedido(pedido) {
        const idInventario = pedidoInventario[pedido.id_pedido];
        if (!idInventario) {
            showMessage('error', `Selecciona el material de Sistemas para la solicitud #${pedido.id_pedido}.`)
            return;
        }
        const inventarioSeleccionado = availableInventory.find(
            (item) => String(item.id_inventario) === String(idInventario)
        );
        if (!inventarioSeleccionado || Number(inventarioSeleccionado.cantidad_disponible) < Number(pedido.cantidad_solicitada) && Number(pedido.cantidad_disponible) >= 0) {
            showMessage('error', 'El material seleccionado no tiene suficiente existencia para cubrir la cantidad solicitada.');
            return;
        }
        if (inventarioSeleccionado && Number(inventarioSeleccionado.cantidad_disponible) <= 0) {
            showMessage('error', `La solicitud #${pedido.id_pedido} ya no tiene stock disponible para asignar.`);
            return;
        }
        setPedidoLoading(pedido.id_pedido);
        showMessage('','');
        try {
            await client.post('/asignaciones', {
                id_pedido: pedido.id_pedido,
                id_inventario: Number(idInventario),
                id_departamento: Number(pedido.id_departamento),
                cantidad: Number(pedido.cantidad_solicitada),
                condicion: String(formCondicion.trim()) || 'Bueno',
                es_devolvible: Boolean(pedido.es_devolvible),
            });
            setPedidos((prev) => prev.map((item) => item.id_pedido === pedido.id_pedido ? { ...item, estatus: 'ENTREGADO' } : item));
            setInventario((prev) => prev.map((item) => item.id_inventario === Number(idInventario)
                ? { ...item, cantidad_disponible: Number(item.cantidad_disponible) - Number(pedido.cantidad_solicitada) }
                : item));
            showMessage('success', `Solicitud #${pedido.id_pedido} asignada.`);
        } catch (err) {
            const status = err.response?.status;
            const serverError = err.response?.data?.error;
            const errorText = typeof serverError === 'string' ? serverError : '';
            let message = 'Error cargar los productos.';

            if (!err.response) {
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (errorText.includes('getaddrinfo')) {
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if (isAdmin) {
                message += ` [${status ?? err.code} | ${errorText || err.message}]`;
            }
            showMessage('error', message);
        } finally {
            setPedidoLoading(null);
        }
    }

    const selectedInvItem = useMemo(
        () => inventario.find((i) => String(i.id_inventario) === String(formIdInventario)),
        [inventario, formIdInventario]
    );

    const kpis = useMemo(() => {
        //asignaciones
        const total = asignaciones.length;
        const activas = Number(asignaciones.filter((a) => a.estatus === 'ACTIVO' && a.es_devolvible === true).length);
        const devueltas = Number(asignaciones.filter((a) => a.estatus === 'DEVUELTO' && a.es_devolvible === true).length);

        //solicitudes
        const totalSolicitudes = pedidos.length;
        const solicitudesPendientes = Number(pedidos.filter((p) => p.estatus === 'PENDIENTE').length);
        const solicitudesAtendidas = Number(pedidos.filter((p) => p.estatus === 'ENTREGADO').length);

        return { total, activas, devueltas, totalSolicitudes, solicitudesPendientes, solicitudesAtendidas };
    }, [asignaciones]);

    const handleOpenCreateModal = () => {
        setFormIdInventario('');
        setFormIdDepartamento('');
        setFormCondicion('Excelente');
        setFormEsDevolvible(false);
        
        showMessage('','');
        setCreateModalOpen(true);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        showMessage('','');

        if (!formIdInventario) {
            showMessage('error', 'Debes seleccionar un producto del inventario.')
            return;
        }
        if (!formIdDepartamento) {
            showMessage('error', 'Debes seleccionar el departamento asignado.');
            return;
        }

        setActionLoading(true);
        try {
            await client.post('/asignaciones', {
                id_inventario: Number(formIdInventario),
                id_departamento: Number(formIdDepartamento),
                condicion: formCondicion.trim() || 'Bueno',
                es_devolvible: formEsDevolvible,
            });
            showMessage('success', 'Asignación registrada exitosamente! El stock fue actualizado.');
            setCreateModalOpen(false);
            fetchData();
        } catch (err) {
            const status = err.response?.status;
            const serverError = err.response?.data?.error;
            const errorText = typeof serverError === 'string' ? serverError : '';
            let message = 'Error cargar los productos.';

            if (!err.response) {
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (errorText.includes('getaddrinfo')) {
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if (isAdmin) {
                message += ` [${status ?? err.code} | ${errorText || err.message}]`;
            }
            showMessage('error', message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenReturnModal = (item) => {
        setReturnItem(item);
        setReturnCondicion(item.condicion || '');
    };

    const handleReturnConfirm = async () => {
        if (!returnItem) return;
        setActionLoading(true);
        try {
            await client.patch(`/asignaciones/${returnItem.id_asignacion}/devolver`, {
                condicion: String(returnCondicion.trim()),
            });
            showMessage('success', '¡Producto devuelto exitosamente! El stock fue actualizado correctamente.');
            setReturnItem(null);
            fetchData();
        } catch (err) {
            const status = err.response?.status;
            const serverError = err.response?.data?.error;
            const errorText = typeof serverError === 'string' ? serverError : '';
            let message = 'Error cargar los productos.';

            if (!err.response) {
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (errorText.includes('getaddrinfo')) {
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if (isAdmin) {
                message += ` [${status ?? err.code} | ${errorText || err.message}]`;
            }
            showMessage('error', message);
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (val) => {
        if (!val) return '-';
        try {
            return new Date(val).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
        } catch {
            return val;
        }
    };

    const hasActiveFilters = search || filterEstatus !== 'ALL' || filterDepto !== 'ALL';

    const isOnMobile = window.innerWidth <= 768;

    const alerta = message.text && (
        <div className={`complementos-alert complementos-alert--${message.type}`} role="alert">
            <div className="complementos-alert__content">
                {message.type === 'error' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                )}
                <span>{message.text}</span>
            </div>
            <button type="button" className="complementos-alert__close" aria-label="Cerrar Alerta" onClick={() => setMessage({ type: '', text: '' })}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    )

    return (
        <Layout>
            <div className="asig-container">
                <header className="asig-header">
                    <div className="asig-header__left">
                        <div className="asig-header__icon-box">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <line x1="19" y1="8" x2="19" y2="14" />
                                <line x1="22" y1="11" x2="16" y2="11" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="asig-header__title">Asignaciones</h1>
                            <p className="asig-header__subtitle">
                                Control y seguimiento de equipos y bienes asignados a departamentos
                            </p>
                        </div>
                    </div>

                    <div className="asig-header__actions">
                        <button
                            type="button"
                            className="asig-icon-btn"
                            onClick={fetchData}
                            title="Recargar datos"
                            disabled={loading}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21.5 1.9v6h-6m5.84 7.67a10 10 0 1 1-.57-8" />
                            </svg>
                        </button>

                        {canManage && (
                            <button
                                type="button"
                                className="asig-btn asig-btn--primary"
                                onClick={handleOpenCreateModal}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Nueva asignación
                            </button>
                        )}
                    </div>
                </header>

                {alerta}

                {activeTab === 'asignaciones' ? (
                    <div className="asig-kpis">
                        <button type="button" onClick={() => setFilterEstatus('ALL')} >
                            <div className="asig-kpi">
                                <div className="asig-kpi__icon-box asig-kpi__icon-box--emerald">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                    </svg>
                                </div>
                                <div className="asig-kpi__content">
                                    <span className="asig-kpi__label" >Total</span>
                                    <span className="asig-kpi__value">{kpis.total}</span>
                                </div>
                            </div>
                        </button>

                        <button type="button" onClick={() => setFilterEstatus('ACTIVO')}>
                            <div className="asig-kpi">
                                <div className="asig-kpi__icon-box asig-kpi__icon-box--amber">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 14 14" />
                                    </svg>
                                </div>
                                <div className="asig-kpi__content">
                                    <span className="asig-kpi__label">Pendientes</span>
                                    <span className="asig-kpi__value">{kpis.activas}</span>
                                </div>
                            </div>
                        </button>

                        <button type="button" onClick={() => setFilterEstatus('DEVUELTO')}>
                            <div className="asig-kpi">
                                <div className="asig-kpi__icon-box asig-kpi__icon-box--green">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="9 11 12 14 22 4" />
                                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                    </svg>
                                </div>
                                <div className="asig-kpi__content">
                                    <span className="asig-kpi__label">Devueltas</span>
                                    <span className="asig-kpi__value">{kpis.devueltas}</span>
                                </div>
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="asig-kpis">
                        <button type="button">
                            <div className="asig-kpi">
                                <div className="asig-kpi__icon-box asig-kpi__icon-box--emerald">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                    </svg>
                                </div>
                                <div className="asig-kpi__content">
                                    <span className="asig-kpi__label" >Total</span>
                                    <span className="asig-kpi__value">{kpis.totalSolicitudes}</span>
                                </div>
                            </div>
                        </button>

                        <button type="button">
                            <div className="asig-kpi">
                                <div className="asig-kpi__icon-box asig-kpi__icon-box--amber">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 14 14" />
                                    </svg>
                                </div>
                                <div className="asig-kpi__content">
                                    <span className="asig-kpi__label">Pendientes</span>
                                    <span className="asig-kpi__value">{kpis.solicitudesPendientes}</span>
                                </div>
                            </div>
                        </button>

                        <button type="button">
                            <div className="asig-kpi">
                                <div className="asig-kpi__icon-box asig-kpi__icon-box--green">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="9 11 12 14 22 4" />
                                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                    </svg>
                                </div>
                                <div className="asig-kpi__content">
                                    <span className="asig-kpi__label">Atendidas </span>
                                    <span className="asig-kpi__value">{kpis.solicitudesAtendidas}</span>
                                </div>
                            </div>
                        </button>
                    </div>
                )}

                <nav className="asig-tabs" role="tablist">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'asignaciones'}
                        className={`asig-tab ${activeTab === 'asignaciones' ? 'asig-tab--active' : ''}`}
                        onClick={() => setActiveTab('asignaciones')}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                        </svg>
                        Asignaciones
                        <span className="asig-tab__count">{asignaciones.length}</span>
                    </button>

                    <button
                        role="tab"
                        aria-selected={activeTab === 'solicitudes'}
                        className={`asig-tab ${activeTab === 'solicitudes' ? 'asig-tab--active' : ''}`}
                        onClick={() => setActiveTab('solicitudes')}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        Solicitudes pendientes
                        {pendingPedidos.length > 0 && (
                            <span className="asig-tab__badge">{pendingPedidos.length}</span>
                        )}
                    </button>
                </nav>

                {activeTab === 'solicitudes' && (
                    <section className="asig-panel">
                        {pendingPedidos.length === 0 ? (
                            <div className="asig-empty">
                                <div className="asig-empty__icon">
                                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                </div>
                                <div className="asig-empty__title">Todo al día</div>
                                <div className="asig-empty__desc">No hay solicitudes pendientes por atender.</div>
                            </div>
                        ) : (
                            <div className="asig-request-list">
                                {pendingPedidos.map((pedido) => (
                                    <div className="asig-request-card" key={pedido.id_pedido}>
                                        <header className="asig-request-card__header">
                                            <div className="asig-request-card__id-group">
                                                <span className="asig-request-card__id">#{pedido.id_pedido}</span>
                                                {pedido.urgente && (
                                                    <span className="asig-request-card__urgent">URGENTE</span>
                                                )}
                                            </div>
                                            <span className="asig-request-card__date">
                                                {formatDate(pedido.fecha_solicitud)}
                                            </span>
                                        </header>

                                        <h3 className="asig-request-card__title">
                                            {pedido.descripcion_material || pedido.producto || 'Material solicitado'}
                                        </h3>

                                        <div className="asig-request-card__meta">
                                            <span className="asig-chip">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                                </svg>
                                                {pedido.departamento || 'Sin depto'}
                                            </span>
                                            <span className="asig-chip">
                                                Cantidad: <strong>{pedido.cantidad_solicitada || pedido.stock_deseado}</strong>
                                            </span>
                                        </div>

                                        <div className="asig-request-card__body">
                                            <div className="asig-form-group asig-form-group--inline">
                                                <label className="asig-label">Material de Sistemas</label>
                                                <select
                                                    className="asig-select"
                                                    value={pedidoInventario[pedido.id_pedido] || ''}
                                                    onChange={(event) => setPedidoInventario((prev) => ({ ...prev, [pedido.id_pedido]: event.target.value }))}
                                                >
                                                    <option value="">Elegir material…</option>
                                                    {availableInventory.map((item) => (
                                                        <option key={item.id_inventario} value={item.id_inventario}>
                                                            {item.producto || item.nombre} · {item.cantidad_disponible} disp.
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <label className="asig-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(pedido.es_devolvible)}
                                                    onChange={(event) => setPedidos((prev) => prev.map((item) => item.id_pedido === pedido.id_pedido
                                                        ? { ...item, es_devolvible: event.target.checked }
                                                        : item))}
                                                />
                                                <span>Devolvible</span>
                                            </label>
                                        </div>

                                        <div className="asig-request-card__footer">
                                            <button
                                                type="button"
                                                className="asig-btn asig-btn--primary asig-btn--block-mobile"
                                                onClick={() => asignarPedido(pedido)}
                                                disabled={pedidoLoading === pedido.id_pedido}
                                            >
                                                {pedidoLoading === pedido.id_pedido ? 'Asignando…' : 'Asignar material'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'asignaciones' && (
                    <section className="asig-panel">
                        <div className="asig-controls">
                            <div className="asig-search">
                                <span className="asig-search__icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    className="asig-search__input"
                                    placeholder="Buscar producto, marca, departamento…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <div className="asig-filters">
                                <select className="asig-select" value={filterEstatus} onChange={(e) => setFilterEstatus(e.target.value)}>
                                    <option value="ALL">Todos los estados</option>
                                    <option value="ACTIVO">Activos</option>
                                    <option value="DEVUELTO">Devueltos</option>
                                    <option value="NO_DEVOLVIBLE">No devolvibles</option>
                                </select>

                                <select className="asig-select" value={filterDepto} onChange={(e) => setFilterDepto(e.target.value)}>
                                    <option value="ALL">Todos los departamentos</option>
                                    {departamentos.map((d) => (
                                        <option key={d.id_departamento} value={d.id_departamento}>
                                            {d.nombre}
                                        </option>
                                    ))}
                                </select>

                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        className="asig-btn asig-btn--ghost"
                                        onClick={() => { setSearch(''); setFilterEstatus('ALL'); setFilterDepto('ALL'); }}
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="asig-table-wrapper">
                            <div className="asig-table-scroll">
                                <table className="asig-table">
                                    <thead>
                                        {isOnMobile ? (
                                            <tr>
                                                <th>ID</th>
                                                <th>Departamento</th>
                                                <th>Asignación</th>
                                                <th>Devolución</th>
                                                {canManage && <th className="asig-th--right">Acciones</th>}
                                            </tr>
                                        ) : (
                                            <tr>
                                                <SortHeader label="ID" sortKey="id" sort={sort} onSort={toggleSort}/>
                                                <SortHeader label="Producto" sortKey="producto" sort={sort} onSort={toggleSort}/>
                                                <SortHeader label="Departamento" sortKey="departamento" sort={sort} onSort={toggleSort}/>
                                                <SortHeader label="Asignación" sortKey="fecha_asignacion" sort={sort} onSort={toggleSort}/>
                                                <SortHeader label="Devolución" sortKey="fecha_devolucion" sort={sort} onSort={toggleSort}/>
                                                <SortHeader label="Condición" sortKey="condicion" sort={sort} onSort={toggleSort}/>
                                                <SortHeader label="Estado" sortKey="estado" sort={sort} onSort={toggleSort}/>
                                                {canManage && <th className="asig-th--right">Acciones</th>}
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={canManage ? 8 : 7}>
                                                    <div className="asig-table__loading">
                                                        <div className="asig-spin"></div>
                                                        Cargando asignaciones…
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredAsignaciones.length === 0 ? (
                                            <tr>
                                                <td colSpan={canManage ? 8 : 7}>
                                                    <div className="asig-empty">
                                                        <div className="asig-empty__icon">
                                                            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                                <circle cx="11" cy="11" r="8" />
                                                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                                            </svg>
                                                        </div>
                                                        <div className="asig-empty__title">Sin resultados</div>
                                                        <div className="asig-empty__desc">
                                                            {hasActiveFilters
                                                                ? 'Prueba ajustar los filtros o la búsqueda.'
                                                                : 'Aún no hay asignaciones registradas.'}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredAsignaciones.map((asig) => {
                                                const isActivo = asig.estatus === 'ACTIVO';
                                                const isDevolvible = asig.es_devolvible;
                                                return (

                                                    <tr key={asig.id_asignacion}>

                                                        {!isOnMobile && (<td className="asig-td--id">#{asig.id_asignacion}</td>)}
                                                        <td>
                                                            <div className="asig-prod-info">
                                                                <span className="asig-prod-info__name">{asig.producto || 'Producto sin nombre'}</span>
                                                                {(asig.marca || asig.modelo) && (
                                                                    <span className="asig-prod-info__meta">
                                                                        {[asig.marca, asig.modelo].filter(Boolean).join(' • ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <button type="button" onClick={() => setFilterDepto(asig.id_departamento)}>
                                                                <span className="asig-dept-tag">
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                                                    </svg>
                                                                    {asig.departamento || 'Sin depto'}
                                                                </span>
                                                            </button>
                                                        </td>

                                                        <td className="asig-td--muted">{formatDate(asig.fecha_asignacion)}</td>
                                                        <td className="asig-td--muted">{isDevolvible ? (formatDate(asig.fecha_devolucion)) : '.'}</td>
                                                        {!isOnMobile && (<td>
                                                            <span className="asig-condition-pill" title={asig.condicion}>
                                                                {asig.condicion || '—'}
                                                            </span>
                                                        </td>)}
                                                        {!isOnMobile && (
                                                            <td>
                                                                <button type="button" onClick={() => setFilterEstatus((isActivo ? (isDevolvible ? 'ACTIVO' : 'NO_DEVOLVIBLE') : 'DEVUELTO'))}>
                                                                    <span className={`asig-badge asig-badge--dot ${isActivo ? (isDevolvible ? 'asig-badge--active' : 'asig-badge--inactive') : 'asig-badge--returned'}`}>
                                                                        {isActivo ? (isDevolvible ? 'Activo' : 'No devolvible') : 'Devuelto'}
                                                                    </span>
                                                                </button>
                                                            </td>
                                                        )}

                                                        {canManage && (
                                                            <td className="asig-td--right">
                                                                {isActivo && asig.es_devolvible ? (
                                                                    <button
                                                                        type="button"
                                                                        className="asig-btn asig-btn--return"
                                                                        onClick={() => handleOpenReturnModal(asig)}
                                                                    >
                                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <polyline points="9 14 4 9 9 4" />
                                                                            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                                                                        </svg>
                                                                        Devolver
                                                                    </button>
                                                                ) : (
                                                                    <span className="asig-td--note">
                                                                        {isActivo ? 'No devolvible' : 'Completado'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="asig-table-footer">
                                <span>
                                    Mostrando <strong>{filteredAsignaciones.length}</strong> de <strong>{asignaciones.length}</strong>
                                </span>
                                {filterEstatus !== 'ALL' && <span className="asig-table-footer__chip">Estado: {filterEstatus === 'NO_DEVOLVIBLE' ? 'NO DEVOLVIBLE' : filterEstatus}</span>}
                            </div>
                        </div>
                    </section>
                )}
            </div>

            {createModalOpen && (
                <div className="asig-modal-overlay" onClick={() => !actionLoading && setCreateModalOpen(false)}>
                    <div className="asig-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="asig-modal__header">
                            <h2 className="asig-modal__title">
                                <span className="asig-modal__title-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                </span>
                                Nueva asignación
                            </h2>
                            <button
                                type="button"
                                className="asig-modal__close"
                                onClick={() => setCreateModalOpen(false)}
                                disabled={actionLoading}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="asig-modal__body">
                                {alerta}
                                <div className="asig-form-group">
                                    <label className="asig-label">
                                        Producto en inventario
                                        <span className="asig-hint">{` ${availableInventory.length}`} disponibles</span>
                                    </label>
                                    <select
                                        className="asig-select asig-select--block"
                                        value={formIdInventario}
                                        onChange={(e) => setFormIdInventario(e.target.value)}
                                        required
                                    >
                                        <option value="">— Selecciona un item del inventario —</option>
                                        {availableInventory.map((inv) => (
                                            <option key={inv.id_inventario} value={inv.id_inventario}>
                                                {inv.producto} {inv.marca ? `(${inv.marca})` : ''} — Stock: {inv.cantidad_disponible}
                                            </option>
                                        ))}
                                    </select>
                                    {availableInventory.length === 0 && (
                                        <span className="asig-hint asig-hint--warning">
                                            No hay productos con stock disponible para asignar.
                                        </span>
                                    )}
                                </div>

                                {selectedInvItem && (
                                    <div className="asig-preview-box">
                                        <div className="asig-preview-box__row">
                                            <span>Producto</span>
                                            <strong>{selectedInvItem.producto} {selectedInvItem.marca && `(${selectedInvItem.marca})`}</strong>
                                        </div>
                                        <div className="asig-preview-box__row">
                                            <span>Ubicación</span>
                                            <strong>{selectedInvItem.departamento || 'Sin asignar'}{selectedInvItem.empresa && ` • ${selectedInvItem.empresa}`}</strong>
                                        </div>
                                        <div className="asig-preview-box__row">
                                            <span>Stock</span>
                                            <strong>{selectedInvItem.cantidad_disponible} unidad(es)</strong>
                                        </div>
                                    </div>
                                )}

                                <div className="asig-form-group">
                                    <label className="asig-label">Departamento destino</label>
                                    <select
                                        className="asig-select asig-select--block"
                                        value={formIdDepartamento}
                                        onChange={(e) => setFormIdDepartamento(e.target.value)}
                                    >
                                        <option value="">— Seleccionar departamento —</option>
                                        {departamentos.filter((d) => (d.id_departamento !== 1 || d.nombre.toLowerCase() !== 'sistemas')).map((d) => (
                                            <option key={d.id_departamento} value={d.id_departamento}>
                                                {d.id_departamento} - {d.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="asig-form-group">
                                    <label className="asig-label">Condición / Observaciones</label>
                                    <input
                                        type="text"
                                        className="asig-input"
                                        placeholder="Ej: Excelente, Nuevo, Con desgaste leve…"
                                        value={formCondicion}
                                        onChange={(e) => setFormCondicion(e.target.value)}
                                        required
                                    />
                                    <span className="asig-hint">Estado físico o notas iniciales del equipo al entregarse.</span>
                                </div>

                                <label className="asig-switch asig-switch--block">
                                    <input
                                        type="checkbox"
                                        checked={formEsDevolvible}
                                        onChange={(e) => setFormEsDevolvible(e.target.checked)}
                                    />
                                    <span>
                                        <strong>Se puede devolver</strong>
                                        <small>El material se espera ser devuelto en el futuro.</small>
                                    </span>
                                </label>
                            </div>

                            <div className="asig-modal__footer">
                                <button
                                    type="button"
                                    className="asig-btn asig-btn--secondary"
                                    onClick={() => setCreateModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="asig-btn asig-btn--primary"
                                    type="submit"
                                    disabled={actionLoading || !formIdInventario || !formIdDepartamento}
                                >
                                    {actionLoading ? 'Guardando…' : 'Guardar asignación'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {returnItem && (
                <div className="asig-modal-overlay" onClick={() => !actionLoading && setReturnItem(null)}>
                    <div className="asig-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="asig-modal__header">
                            <h2 className="asig-modal__title">
                                <span className="asig-modal__title-icon asig-modal__title-icon--amber">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="9 14 4 9 9 4" />
                                        <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                                    </svg>
                                </span>
                                Registrar devolución
                            </h2>
                            <button
                                type="button"
                                className="asig-modal__close"
                                onClick={() => setReturnItem(null)}
                                disabled={actionLoading}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="asig-modal__body">
                            {alerta}
                            <div className="asig-preview-box">
                                <div className="asig-preview-box__row">
                                    <span>Asignación</span>
                                    <strong>#{returnItem.id_asignacion}</strong>
                                </div>
                                <div className="asig-preview-box__row">
                                    <span>Producto</span>
                                    <strong>{returnItem.producto} {returnItem.marca && `(${returnItem.marca})`}</strong>
                                </div>
                                <div className="asig-preview-box__row">
                                    <span>Departamento</span>
                                    <strong>{returnItem.departamento}</strong>
                                </div>
                                <div className="asig-preview-box__row">
                                    <span>Fecha asignación</span>
                                    <strong>{formatDate(returnItem.fecha_asignacion)}</strong>
                                </div>
                                <p className="asig-preview-box__note">
                                    El estado cambiará a <strong>DEVUELTO</strong> y se reincorporará 1 unidad al stock.
                                </p>
                            </div>

                            <div className="asig-form-group">
                                <label className="asig-label">Condición de devolución</label>
                                <input
                                    type="text"
                                    className="asig-input"
                                    placeholder="Ej: Bueno, Completo, Con desgaste leve…"
                                    value={returnCondicion}
                                    onChange={(e) => setReturnCondicion(e.target.value)}
                                />
                                <span className="asig-hint">Actualiza el estado físico en que se entrega el producto.</span>
                            </div>
                        </div>

                        <div className="asig-modal__footer">
                            <button
                                type="button"
                                className="asig-btn asig-btn--secondary"
                                onClick={() => setReturnItem(null)}
                                disabled={actionLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="asig-btn asig-btn--warning"
                                onClick={handleReturnConfirm}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Procesando…' : 'Confirmar devolución'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default Asignaciones;