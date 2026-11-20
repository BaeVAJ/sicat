import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import Layout from '../../layout/Layout';
import './Compras.css'
import client from '../../../api/client';

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

function Compras() {
    const { usuario } = useAuth();

    const [compras, setCompras] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [productos, setProductos] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [facturas, setFacturas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [search, setSearch] = useState('');
    const [filterProveedor, setFilterProveedor] = useState('ALL');
    const [filterEmpresa, setFilterEmpresa] = useState('ALL');

    const [modalOpen, setModalOpen] = useState(false);
    const [formIdProveedor, setFormIdProveedor] = useState('');
    const [formIdEmpresa, setFormIdEmpresa] = useState('');
    const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
    const [formDetalle, setFormDetalle] = useState([{ id_producto: '', cantidad: 1, precio_unitario: '', id_departamento: '' }]);

    const [detailCompra, setDetailCompra] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [deleteItem, setDeleteItem] = useState(null);
    const [openDeleteModal, setOpenDeleteModal] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const [message, setMessage] = useState({ type: '', text: '' });
    const navigate = useNavigate();

    const [showResults, setShowResults] = useState(false);

    const canManage = usuario?.rol === 'admin' || usuario?.rol === 'gerente';

    const [filters, setFilters] = useState({
        id_compra: '',
        proveedor: '',
        empresa: '',
        fecha_compra: '',
        total: '',
    });
    const [sort, setSort] = useState({ key: 'id', dir: 'desc' });

    const [minFecha, setMinFecha] = useState('');
    const [maxFecha, setMaxFecha] = useState('');

    const showMessage = useCallback((type, text) => {
        setMessage({ type, text });
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        if (message.type === 'error') {
            showMessage('', '');
        }
        try {
            const [cRes, pRes, eRes, prRes, dRes, facRes] = await Promise.all([
                client.get('/compras'),
                client.get('/proveedores').catch(() => ({ data: {} })),
                client.get('/empresas').catch(() => ({ data: {} })),
                client.get('/productos').catch(() => ({ data: {} })),
                client.get('/departamentos').catch(() => ({ data: {} })),
                client.get('/facturas').catch(() => ({ data: {}})),
            ]);
            setCompras(Array.isArray(cRes.data) ? cRes.data : [])
            setProveedores(Array.isArray(pRes.data) ? pRes.data : [])
            setEmpresas(Array.isArray(eRes.data) ? eRes.data : [])
            setProductos(Array.isArray(prRes.data) ? prRes.data : [])
            setDepartamentos(Array.isArray(dRes.data) ? dRes.data : [])
            setFacturas(Array.isArray(facRes.data) ? facRes.data : [])
        } catch (err) {
            const status = err.response?.status;
            const serverError = err.response?.data?.error;
            const errorText = typeof serverError === 'string' ? serverError : '';
            let message = 'Error cargar las compras.';

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
    };

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
                return item.id_compra;
            case 'proveedor':
                return normalizar(item.proveedor);
            case 'empresa':
                return normalizar(item.empresa);
            case 'fecha':
                return normalizar(item.fecha_compra);
            case 'total':
                return normalizar(item.total);
            default:
                return item[key] ?? null;
        }
    }

    const comprasFiltradas = useMemo(() => {
        const lista = compras.filter(c => {
            const fechaMin = minFecha ? new Date(`${minFecha}T00:00:00`) : null;
            const fechaMax = maxFecha ? new Date(`${maxFecha}T23:59:59.999`) : null;
            const fechaCompra = c.fecha_compra ? new Date(c.fecha_compra) : null;
            const q = search.toLowerCase();

            const matchSearch =
                String(c.id_compra).includes(q) ||
                (c.proveedor || '').toLowerCase().includes(q) ||
                (c.empresa || '').toLowerCase().includes(q);

            if (!matchSearch) return false;

            if (filterProveedor !== 'ALL' && String(c.id_proveedor) !== filterProveedor) return false;
            if (filterEmpresa !== 'ALL' && String(c.id_empresa) !== filterEmpresa) return false;
            if (fechaMin) {
                if (fechaMin && fechaMin > fechaCompra) return false;
                
            }
            if (fechaMax){
                if (fechaMax && fechaMax < fechaCompra) return false;
            }
            return true;
        })

        const factor = sort.dir === 'asc' ? 1 : -1;
        if (sort.key === 'total') {
            return [...lista].sort((a, b) => {
                const va = parseFloat(a.total) || 0;
                const vb = parseFloat(b.total) || 0;
                if (va < vb) return -1 * factor;
                if (va > vb) return 1 * factor;
                return 0;
            })
        }
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
    }, [compras, search, filterProveedor, filterEmpresa, filters, sort, minFecha, maxFecha]);

    const deptoFilter = useMemo(() => {
        const q = formIdEmpresa;
        if (!q) return departamentos;
        if (String(q) !== String(formIdEmpresa)) return false
        return departamentos.filter(d => String(d.id_empresa) === String(q));

    }, [departamentos, formIdEmpresa]);

    const totalCompras = comprasFiltradas.length;
    const montoTotal = comprasFiltradas.reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
    const proveedoresUnidos = new Set(comprasFiltradas.map(c => c.id_proveedor)).size;

    const formatMoney = (val) => {
        const n = parseFloat(val);
        if (isNaN(n)) return '0.00';
        return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    const formatDate = (d) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: 'numeric' });
    }

    const handleOpenCreate = () => {
        setFormIdProveedor('');
        setFormIdEmpresa('');
        setFormFecha(new Date().toISOString().split('T')[0]);
        setFormDetalle([{ id_producto: '', cantidad: 1, precio_unitario: '', id_departamento: '' }]);
        showMessage('', '');
        setModalOpen(true);
    }

    const handleAddLine = () => {
        setFormDetalle(prev => [...prev, { id_producto: '', cantidad: 1, precio_unitario: '', id_departamento: '' }]);
    }

    const handleLineChange = (idx, field, value) => {
        setFormDetalle(prev =>
            prev.map((line, i) => i === idx ? { ...line, [field]: value } : line)
        );
    };

    const handleRemoveLine = (index) => {
        setFormDetalle(prev => prev.filter((_, i) => i !== index));
    }

    const formTotal = useMemo(() => {
        return formDetalle.reduce((s, d) => s + (d.cantidad || 0) * (parseFloat(d.precio_unitario) || 0), 0);
    }, [formDetalle]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        showMessage('', '');
        if (!formIdProveedor) {
            showMessage('error', 'Seleccione un proveedor');
            return;
        }
        if (!formIdEmpresa) {
            showMessage('error', 'Seleccione una empresa');
            return;
        }
        if (formDetalle.length === 0) {
            showMessage('error', 'Agregue al menos un producto');
            return;
        }

        for (let i = 0; i < formDetalle.length; i++) {
            const d = formDetalle[i];
            if (!d.id_producto) {
                showMessage('error', 'Seleccione un producto para cada línea');
                return;
            }
            if (!d.cantidad) {
                showMessage('error', 'Ingrese la cantidad para cada línea');
                return;
            }
            if (!d.precio_unitario) {
                showMessage('error', 'Ingrese la cantiad para caa línea');
                return;
            }
            if (!d.id_departamento) {
                showMessage('error', 'Seleccione un departamento para cada línea');
                return;
            }
        }
        setActionLoading(true);
        try {
            const payload = {
                id_proveedor: formIdProveedor,
                id_empresa: formIdEmpresa,
                fecha_compra: formFecha,
                detalle: formDetalle.map(d => ({
                    id_producto: Number(d.id_producto),
                    cantidad: Number(d.cantidad),
                    precio_unitario: parseFloat(d.precio_unitario),
                    id_departamento: Number(d.id_departamento)
                })),
            };
            await client.post('/compras', payload);
            showMessage('success', 'Compra registrada exitosamente');
            setModalOpen(false);
            fetchData();
        } catch (err) {
            const status = err.response?.status;
            const serverError = err.response?.data?.error;
            const errorText = typeof serverError === 'string' ? serverError : '';

            let message = 'Error al registrar la compra. ';

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
    }

    const handleDepartamentoChoose = (idx, e) => {
        handleLineChange(idx, 'id_departamento', e.target.value);
        setFormIdEmpresa(deptoFilter.find(d => String(d.id_departamento) === e.target.value)?.id_empresa || '');
    }

    const handleOpenDelete = async (item) => {
        showMessage('', '');
        setConfirmDelete(false);
        setOpenDeleteModal(true);
        setDeleteItem(item);
        try {
            const { data } = await client.get(`/compras/${item.id_compra}`);
            setDeleteItem(data);
        } catch (err) {
            setDeleteItem({ ...item, detalle: [] });
            showMessage('error', 'No se pudo cargar el detalle de la compra.');
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteItem) return;

        if (deleteItem.detalle?.some(d => Number(d.cantidad) > Number(d.inventario))) {
            showMessage('error', 'La cantidad de la compra de un producto a eliminar es mayor a la cantidad del inventario.');
            return;
        }

        setActionLoading(true);
        try {
            await client.delete(`/compras/${deleteItem.id_compra}`);
            showMessage('success', 'Compra eliminada exitosamente');
            setOpenDeleteModal(false);
            setDeleteItem(null);
            setConfirmDelete(false);
            fetchData();
        } catch (err) {
            const status = err.response?.status;
            const serverError = err.response?.data?.error;
            const errorText = typeof serverError === 'string' ? serverError : '';
            let message = 'Error al eliminar la compra.';

            if (!err.response) {
                message = 'No se pudo conectar con el servidor.';
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

    const handleOpenDetail = async (compra) => {
        setDetailLoading(true);
        setDetailCompra(null);
        showMessage('', '');
        try {
            const { data } = await client.get(`/compras/${compra.id_compra}`);
            setDetailCompra(data);
        } catch (err) {
            setDetailCompra({ ...compra, detalle: [] });
            const status = err.response?.status;
            const serverError = err.response?.data?.error;
            const errorText = typeof serverError === 'string' ? serverError : '';

            let message = 'Error al cargar los detalles de la compra. ';

            if (!err.response) {
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (errorText.includes('getaddrinfo')) {
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if (isAdmin) {
                message += `[ ${status ?? err.code} | ${errorText || err.message}]`;
            }
            showMessage('error', message);
        } finally {
            setDetailLoading(false);
        }
    }

    const isAdmin = usuario?.rol === 'admin';
    const isGerente = usuario?.rol === 'gerente';
    const canCreate = isAdmin || isGerente;

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

    const existeFactura = useCallback((id_compra) => {
        return facturas.some(f=> f.id_compra === id_compra);
    })

    

    return (
        <Layout>
            <div className="compras-container">
                <header className="compras-header">
                    <span className="compras-title">
                        <h1 className="compras-header__title">
                            <span className="compras-header__icon-box">
                                <svg xmlns="http://w3.org" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="8" cy="21" r="1"></circle>
                                    <circle cx="19" cy="21" r="1"></circle>
                                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
                                </svg>
                            </span>
                            Compras
                        </h1>
                        
                    </span>
                    <div className="compras-header__actions">
                        <button className="compras-btn compras-btn--secondary" onClick={fetchData} disabled={loading}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'compras-btn__spin' : ''}>
                                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            <span>Refrescar</span>
                        </button>
                        {canCreate && (
                            <button className="compras-btn compras-btn--primary" onClick={handleOpenCreate}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Nueva Compra</span>
                            </button>
                        )}
                    </div>
                </header>
                {alerta}
                <div className="compras-kpis">
                    <div className="compras-kpi">
                        <div className="compras-kpi__icon-box--blue">
                            <svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="2" y1="9" x2="22" y2="9" /></svg>
                        </div>
                        <div className="compras-kpi__content">
                            <div className="compras-kpi__label">Total de compras</div>
                            <div className="compras-kpi__value">{totalCompras}</div>
                        </div>
                    </div>

                    <div className="compras-kpi">
                        <div className="compras-kpi__icon-box compras-kpi__icon-box--emerald">
                            <svg width="22px" height="22px" viewBox="0 0 24 24" role="img" xmlns="http://www.w3.org/2000/svg" aria-labelledby="dolarIconTitle" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" color="currentColor"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 4L12 6M12 18L12 20M15.5 8C15.1666667 6.66666667 14 6 12 6 9 6 8.5 7.95652174 8.5 9 8.5 13.140327 15.5 10.9649412 15.5 15 15.5 16.0434783 15 18 12 18 10 18 8.83333333 17.3333333 8.5 16"></path> </g></svg>
                        </div>
                        <div className="compras-kpi__content">
                            <div className="compras-kpi__label">Total de compras</div>
                            <div className="compras-kpi__value">{formatMoney(montoTotal)}</div>
                        </div>
                    </div>

                    <div className="compras-kpi">
                        <div className="compras-kpi__icon-box compras-kpi__icon-box--cyan">
                            <svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="2" y1="9" x2="22" y2="9" /></svg>
                        </div>
                        <div className="compras-kpi__content">
                            <div className="compras-kpi__label">Total de proveedores</div>
                            <div className="compras-kpi__value">{proveedoresUnidos}</div>
                        </div>
                    </div>
                </div>

                <div className="compras-filters">
                    <div className="compras-search-wrap">
                        <svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="compras-search-icon">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            className="compras-search-input"
                            placeholder="Buscar por ID, proveedor o empresa..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && <button className="compras-search-clear" onClick={() => setSearch('')}>&times;</button>}
                    </div>
                    <select className="compras-select" value={filterProveedor} onChange={e => setFilterProveedor(e.target.value)}>
                        <option value="ALL">Todos los proveedores</option>
                        {proveedores.map(p => <option key={p.id_proveedor} value={String(p.id_proveedor)}>{p.nombre}</option>)}
                    </select>
                    <select className="compras-select" value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)}>
                        <option value="ALL">Todas las empresas</option>
                        {empresas.map(e => <option key={e.id_empresa} value={String(e.id_empresa)}> {e.nombre} </option>)}
                    </select>
                    <input
                        type="date"
                        className="compras-input--date"
                        value={minFecha}
                        onChange={(e) => setMinFecha(e.target.value)}
                    />
                    <input
                        type="date"
                        className="compras-input--date"
                        value={maxFecha}
                        onChange={(e) => setMaxFecha(e.target.value)}
                    />
                </div>
                {loading ? (
                    <div className="compras-loading">
                        <div className="compras-spinner">
                        </div>
                        <p>Cargando Empresas...</p>
                    </div>
                ) : comprasFiltradas.length === 0 ? (
                    <div className="compras-empty">
                        <div className="compras-empty-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                            </svg>
                        </div>
                        <h3>No se encontraron compras</h3>
                        <p>{search || filterProveedor !== 'ALL' || filterEmpresa !== 'ALL' ? 'No hay resultados con los filtros aplicados.' : "Aún no hay compras registradas."}</p>
                    </div>
                ) : (
                    <div className="compras-table-wrap">
                        <table className="compras-table">
                            <thead>
                                <tr>
                                    <SortHeader label="ID" sortKey="id" sort={sort} onSort={toggleSort} />
                                    <SortHeader label="Proveedor" sortKey="proveedor" sort={sort} onSort={toggleSort} />
                                    <SortHeader label="Empresa" sortKey="empresa" sort={sort} onSort={toggleSort} />
                                    <SortHeader label="Fecha" sortKey="fecha" sort={sort} onSort={toggleSort} />
                                    <SortHeader label="Total" sortKey="total" sort={sort} onSort={toggleSort} className="compras-table__total" />
                                    <th style={{ textAlign: 'right' }}>acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comprasFiltradas.map(c => (
                                    <tr key={c.id_compra} onClick={() => handleOpenDetail(c)}>
                                        <td><span className="compras-table__id">{c.id_compra}</span></td>
                                        <td><span className="compras-badge compras-badge-proveedor">{c.proveedor}</span></td>
                                        <td><span className="compras-badge compras-badge-empresa">{c.empresa}</span></td>
                                        <td>{formatDate(c.fecha_compra)}</td>
                                        <td style={{ textAlign: 'right' }}> <span className="compras-table__total">{formatMoney(c.total)}</span></td>
                                        {canCreate && (
                                            <td>
                                                <div className="compras-row-actions" onClick={e => e.stopPropagation()}>
                                                    <button className="compras-action-btn" onClick={() => handleOpenDetail(c)} title="Ver detalle">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                    </button>
                                                    <button className="compras-action-btn compras-action-btn--delete" onClick={() => handleOpenDelete(c)}>
                                                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                                                            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                                                            <g id="SVGRepo_iconCarrier">
                                                                <path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                </path>
                                                            </g>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>)}
                {modalOpen && (
                    <div className="compras-modal-overlay" onClick={() => setModalOpen(false)}>
                        <div className="compras-modal compras-modal--wide" onClick={e => e.stopPropagation()}>
                            <div className="compras-modal__header">
                                <h2 className="compras-modal__title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                    </svg>
                                    Registrar Nueva Compra
                                </h2>
                                <button className="compras-modal__close" onClick={() => setModalOpen(false)} disabled={actionLoading}>&times;</button>
                            </div>
                            <form className="compras-form" onSubmit={handleSubmit}>
                                {alerta}
                                <div className="compras-grid-3">
                                    <div className="compras-form__group">
                                        <label className="compras-form-label">Proveedor <span className="compras-req"></span></label>
                                        <select className="compras-input" value={formIdProveedor} onChange={(e) => setFormIdProveedor(e.target.value)}>
                                            <option value="">Seleccionar...</option>
                                            {proveedores.map(p => <option key={p.id_proveedor} value={String(p.id_proveedor)}>{p.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="compras-form__group">
                                        <label className="compras-form-label">Empresa Destino<span className="compras-req"></span></label>
                                        <select className="compras-input" value={formIdEmpresa} onChange={(e) => setFormIdEmpresa(e.target.value)}>
                                            <option value=''>Seleccionar...</option>
                                            {empresas.map(e => <option key={e.id_empresa} value={String(e.id_empresa)}>{e.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="compras-form-group">
                                        <label className="compras-label">Fecha</label>
                                        <input type="date" className="compras-input" value={formFecha} onChange={e => setFormFecha(e.target.value)} />
                                    </div>
                                </div>
                                <div className="compras-lines-section">
                                    <div className="compras-lines-header">
                                        <span className="compras-lines-header__title">Detalle de productos</span>
                                        <button type="button" className="compras-btn compras-btn--secondary" onClick={() => handleAddLine()}>
                                            Agregar Linea
                                        </button>
                                    </div>
                                    <table className="Compras-lines-table">
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th style={{ width: '90px' }}>Cantidad</th>
                                                <th style={{ width: '120px' }}>Precio Unit.</th>
                                                <th>Depto. Destino</th>
                                                <th style={{ width: '90px' }}>Subtotal</th>
                                                <th style={{ width: '40px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formDetalle.map((line, idx) => (
                                                <tr key={idx}>
                                                    <td>

                                                            {/*hacer que cuando se escriba el nombre de un producto se muestre las opciones disponibles y si no existe se cree desde aca */}
                                                        <div className="solic-form--input-group">
                                <input
                                    className="compras-input"
                                    type="text"
                                    id="proucto"
                                    autoComplete="off"
                                    value={(formDetalle[idx].id_producto) ? productos.find(p => String(p.id_producto) === String(formDetalle[idx].id_producto))?.nombre || '' : ''}
                                    onChange={(e) => {
                                        handleLineChange(idx, 'id_producto', e.target.value);
                                    }}
                                    onFocus={() => setShowResults(true)}
                                    onBlur={() => setTimeout(() => setShowResults(false), 160)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') setShowResults(false);
                                    }}
                                    required
                                    placeholder="Escribe el material"
                                />

                                {productos.length > 0 && showResults && (
                                    <ul className="search-results" role="listbox" aria-label="Sugerencias de materiales">
                                        {productos.map((item) => (
                                            <li
                                                key={item.producto}
                                                className="search-result-item"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    handleLineChange(idx, 'id_producto', item.id_producto);
                                                    setShowResults(false);
                                                }}
                                            >
                                                {item.nombre} {item.marca ? ` - ${item.marca}` : ''} {item.modelo ? ` - ${item.modelo}` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                                                    </td>
                                                    <td><input type="number" className="compras-input compras-input--val" min="1" value={formDetalle[idx].cantidad} onChange={(e) => handleLineChange(idx, 'cantidad', e.target.value)} /></td>
                                                    <td><input type="number" className="compras-input" min="0" step="0.01" value={formDetalle[idx].precio_unitario} onChange={(e) => handleLineChange(idx, 'precio_unitario', e.target.value)} /></td>
                                                    <td>
                                                        <select name="deptoChoose" className="compras-input" value={formDetalle[idx].id_departamento} onChange={(e) => handleDepartamentoChoose(idx, e)}>
                                                            <option id="deptoChoose" value="">Seleccionar</option>
                                                            {deptoFilter.map(d => <option key={d.id_departamento} value={String(d.id_departamento)}>{d.nombre} · {d.empresa}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="compras-line-subtotal">{formatMoney(formDetalle[idx].cantidad * formDetalle[idx].precio_unitario)}</td>
                                                    <td>
                                                        {formDetalle.length > 1 && (
                                                            <button type="button" className="compras-line-remove" onClick={() => handleRemoveLine(idx)} disabled={formDetalle.length === 1}>
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="compras-total-row">
                                        Total: {formatMoney(formTotal)}
                                    </div>
                                </div>
                                <div className="compras-modal__footer">
                                    <button type="button" className="compras-btn compras-btn--secondary" onClick={() => setModalOpen(false)} disabled={actionLoading}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="compras-btn compras-btn--primary" disabled={actionLoading}>
                                        {actionLoading && <span className="compras-btn__spin"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /></svg></span>}
                                        {actionLoading ? 'Procesando...' : "Aceptar"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {(detailCompra || detailLoading) && (
                    <div className="compras-modal-overlay" onClick={() => { setDetailCompra(null); setDetailLoading(false) }}>
                        <div className="compras-modal compras-modal--wide" onClick={e => e.stopPropagation()}>
                            <div className="compras-modal__header">
                                <h2 className="compras-modal__title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                    Detalle de Compra {detailCompra && `#${detailCompra.id_compra}`}
                                </h2>
                                <button className="compras-modal__close" onClick={() => { setDetailCompra(null); setDetailLoading(false) }}>&times;</button>
                            </div>
                            {detailLoading ? (
                                <div className="compras-loading" style={{ padding: '20px' }}>
                                    <div className="compras-spinner"></div>
                                    <p>Cargando detalles de la compra...</p>
                                </div>
                            ) : detailCompra && (
                                <>
                                    <div className="compras-detail-grid">
                                        <div className="compras-detail-card">
                                            <span className="compras-detail-card__label">Proveedor</span>
                                            <span className="compras-detail-card__val">{detailCompra.proveedor}</span>
                                        </div>
                                        <div className="compras-detail-card">
                                            <span className="compras-detail-card__label">Empresa</span>
                                            <span className="compras-detail-card__val">{detailCompra.empresa}</span>
                                        </div>
                                        <div className="compras-detail-card">
                                            <span className="compras-detail-card__label">Fecha</span>
                                            <span className="compras-detail-card__val">{formatDate(detailCompra.fecha_compra)}</span>
                                        </div>
                                        <div className="compras-detail-card">
                                            <span className="compras-detail-card__label">Total</span>
                                            <span className="compras-detail-card__val">{formatMoney(detailCompra.total)}</span>
                                        </div>
                                    </div>
                                    {alerta}
                                    {detailCompra.detalle && detailCompra.detalle.length > 0 && (
                                        <div className="compras-lines-section">
                                            <div className="compras-lines-header">
                                                <span className="compras-lines-header__title">Productos ({detailCompra.detalle.length})</span>
                                            </div>
                                            <div className="compras-table-wrap">
                                                <table className="compras-lines-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Producto</th>
                                                            <th>Marca</th>
                                                            <th>Modelo</th>
                                                            <th>Depto.</th>
                                                            <th>Cantidad</th>
                                                            <th>Precio Unit.</th>
                                                            <th>Subtotal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody style={{ textAlign: 'center' }}>
                                                        {detailCompra.detalle.map((d, i) => (
                                                            <tr key={i}>
                                                                <td>{d.nombre}</td>
                                                                <td>{d.marca}</td>
                                                                <td>{d.modelo}</td>
                                                                <td>{departamentos.find(dep => dep.id_departamento === d.id_departamento)?.nombre || d.id_departamento}</td>
                                                                <td>{d.cantidad}</td>
                                                                <td>{formatMoney(d.precio_unitario)}</td>
                                                                <td>{formatMoney(d.cantidad * d.precio_unitario)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                    <div className="compras-modal__footer">
                                        <button className="compras-btn compras-action-btn--delete" onClick={() => handleOpenDelete(detailCompra)}>
                                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                                                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                                                <g id="SVGRepo_iconCarrier">
                                                    <path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    </path>
                                                </g>
                                            </svg>
                                            Eliminar
                                        </button>
                                        
                                            {!existeFactura(detailCompra.id_compra) && (
                                            <button className="compras-btn compras-btn--factura" onClick={() => navigate(`/facturas/?idCompra=${detailCompra.id_compra}&pagoModalOpen=true`)}>
                                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g/><g/><path d="M10.5 11H17M7 11h.5M7 7.5h.5m-.5 7h.5m9.5 0h-1m-5.5 0h3m3.5-7h-3m-3.5 0h1M21 7v-.63c0-1.193 0-1.79-.158-2.27a3.05 3.05 0 0 0-1.881-1.937C18.493 2 17.914 2 16.755 2h-9.51c-1.159 0-1.738 0-2.206.163a3.05 3.05 0 0 0-1.881 1.936C3 4.581 3 5.177 3 6.37V15m18-4v9.374c0 .858-.985 1.314-1.608.744a.946.946 0 0 0-1.284 0l-.483.442a1.657 1.657 0 0 1-2.25 0 1.657 1.657 0 0 0-2.25 0 1.657 1.657 0 0 1-2.25 0 1.657 1.657 0 0 0-2.25 0 1.657 1.657 0 0 1-2.25 0l-.483-.442a.946.946 0 0 0-1.284 0c-.623.57-1.608.114-1.608-.744V19" stroke="currentColor"/></svg>
                                                Crear Factura
                                            </button>
                                            )}
                                            {existeFactura(detailCompra.id_compra) && (
                                                <button className="compras-btn compras-btn--factura" onClick={() => navigate(`/facturas/?id_compra=${detailCompra.id_compra}`)}>
                                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g/><g/><path d="M10.5 11H17M7 11h.5M7 7.5h.5m-.5 7h.5m9.5 0h-1m-5.5 0h3m3.5-7h-3m-3.5 0h1M21 7v-.63c0-1.193 0-1.79-.158-2.27a3.05 3.05 0 0 0-1.881-1.937C18.493 2 17.914 2 16.755 2h-9.51c-1.159 0-1.738 0-2.206.163a3.05 3.05 0 0 0-1.881 1.936C3 4.581 3 5.177 3 6.37V15m18-4v9.374c0 .858-.985 1.314-1.608.744a.946.946 0 0 0-1.284 0l-.483.442a1.657 1.657 0 0 1-2.25 0 1.657 1.657 0 0 0-2.25 0 1.657 1.657 0 0 1-2.25 0 1.657 1.657 0 0 0-2.25 0 1.657 1.657 0 0 1-2.25 0l-.483-.442a.946.946 0 0 0-1.284 0c-.623.57-1.608.114-1.608-.744V19" stroke="currentColor"/></svg>
                                                    Ver Factura
                                                </button>
                                            )}
                                        
                                        
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
                {openDeleteModal && handleOpenDelete && (
                    <div className="compras-modal-overlay" onClick={() => { setOpenDeleteModal(false); setDeleteItem(null) }}>
                        <div className="compras-modal" onClick={e => e.stopPropagation()}>
                            <div className="compras-modal__header">
                                <h2 className="compras-modal__title">Eliminar Compra <strong>#{deleteItem?.id_compra}</strong></h2>
                                <button className="compras-modal__close" onClick={() => { setDeleteItem(null); setOpenDeleteModal(false) }}>&times;</button>
                            </div>
                            <p className="compras-modal__body--text">Estás seguro de que quieres eliminar esta compra?</p>
                            {confirmDelete && (<div className="compras-modal__body">
                                <div className="compras-modal__body--warning">
                                    <p><strong>Esta acción no se puede deshacer</strong></p>
                                    <p>No se eliminará si contiene facturas asociadas o el inventario asociado es menor al de la compra</p>
                                </div>
                            </div>)}
                            <div className="compras-modal__footer">
                                <button type="button" className="compras-btn compras-btn--secondary" onClick={() => { setDeleteItem(null); setOpenDeleteModal(false) }}>Cancelar</button>
                                <button type="button" className={`compras-btn compras-btn--${confirmDelete ? 'danger' : 'primary'}`} onClick={confirmDelete ? (handleConfirmDelete) : (() => setConfirmDelete(true))} disabled={actionLoading}>
                                    {confirmDelete ? 'Confirmar Eliminación' : 'Eliminar Compra'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}
export default Compras