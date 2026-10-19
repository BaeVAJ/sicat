import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Layout from '../../layout/Layout';
import './Compras.css'
import client from '../../../api/client';

function Compras() {
    const { usuario } = useAuth();

    const [compras, setCompras] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [productos, setProductos] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [search, setSearch] = useState('');
    const [filterProveedor, setFilterProveedor] = useState('ALL');
    const [filterEmpresa, setFilterEmpresa] = useState('ALL');

    const [modalOpen, setModalOpen] = useState(false);
    const [formIdProveedor, setFormIdProveedor] = useState('');
    const [formIdEmpresa, setFormIdEmpresa] = useState('');
    const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
    const [formDetalle, setFormDetalle] = useState([{ id_producto: '', cantidad: 1, precio_unitario: '', id_departamento: '' }]);
    const [formError, setFormError] = useState('');

    const [detailCompra, setDetailCompra] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);


    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (success) {
            const t = setTimeout(() => setSuccess(''), 4000)
            return () => clearTimeout(t);
        }
    })

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [cRes, pRes, eRes, prRes, dRes] = await Promise.all([
                client.get('/compras'),
                client.get('/proveedores').catch(() => ({ data: {} })),
                client.get('/empresas').catch(() => ({ data: {} })),
                client.get('/productos').catch(() => ({ data: {} })),
                client.get('/departamentos').catch(() => ({ data: {} })),
            ]);
            setCompras(Array.isArray(cRes.data) ? cRes.data : [])
            setProveedores(Array.isArray(pRes.data) ? pRes.data : [])
            setEmpresas(Array.isArray(eRes.data) ? eRes.data : [])
            setProductos(Array.isArray(prRes.data) ? prRes.data : [])
            setDepartamentos(Array.isArray(dRes.data) ? dRes.data : [])
        } catch (err) {
            setError(err.response?.data?.message || 'Error al cargar los datos');
        } finally {
            setLoading(false);
        }
    };

    const comprasFiltradas = useMemo(() => {
        return compras.filter(c => {
            const q = search.toLowerCase();
            const matchSearch =
                String(c.id_compra).includes(q) ||
                (c.proveedor || '').toLowerCase().includes(q) ||
                (c.empresa || '').toLowerCase().includes(q);
            if (!matchSearch) return false;
            if (filterProveedor !== 'ALL' && String(c.id_proveedor) !== filterProveedor) return false;
            if (filterEmpresa !== 'ALL' && String(c.id_empresa) !== filterEmpresa) return false;
            return true;
        })
    }, [compras, search, filterProveedor, filterEmpresa]);

    const totalCompras = compras.length;
    const montoTotal = compras.reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
    const proveedoresUnidos = new Set(compras.map(c => c.id_proveedor)).size;

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
        setFormError('');
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
        setFormError('');
        if (!formIdProveedor) {
            setFormError('Seleccione un proveedor');
            return;
        }
        if (!formIdEmpresa) {
            setFormError('seleccione una empresa');
            return;
        }
        if (formDetalle.length === 0) {
            setFormError('Agregue al menos un producto');
            return;
        }

        for (let i = 0; i < formDetalle.length; i++) {
            const d = formDetalle[i];
            if (!d.id_producto) {
                setFormError('Seleccione un producto para cada línea');
                return;
            }
            if (!d.cantidad) {
                setFormError('Ingrese la cantidad para cada línea');
                return;
            }
            if (!d.precio_unitario) {
                setFormError('Ingrese el precio unitario para cada línea');
                return;
            }
            if (!d.id_departamento) {
                setFormError('Seleccione un departamento para cada línea');
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
            setSuccess('Compra registrada exitosamente');
            setModalOpen(false);
            fetchData();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Error al registrar la compra');
        } finally {
            setActionLoading(false);
        }
    }
    const handleOpenDetail = async (compra) => {
        setDetailLoading(true);
        setDetailCompra(null);
        try {
            const { data } = await client.get(`/compras/${compra.id_compra}`);
            setDetailCompra(data);
            console.log('Detalle de compra:', data);
        } catch {
            setDetailCompra({ ...compra, detalle: [] });
        } finally {
            setDetailLoading(false);
        }
    }



    const isAdmin = usuario?.rol === 'admin';
    const isGerente = usuario?.rol === 'gerente';
    const canCreate = isAdmin || isGerente;

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
                        <p className="compras-header__subtitle">Registro de compras</p>
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

                {error && (
                    <div className="compras-alert compras-alert--error">
                        <div className="compras-alert__content">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                            {error}
                        </div>
                    </div>
                )}
                {success && (
                    <div className="compras-alert compras-alert--success">
                        <div className="compras-alert__content">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                            {success}
                        </div>
                    </div>
                )}

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
                            <div className="compras-kpi__value">{montoTotal}</div>
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
                                    <th>ID</th>
                                    <th>Proveedor</th>
                                    <th>Empresa</th>
                                    <th>fecha</th>
                                    <th style={{ textAlign: 'right' }}>total</th>
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
                                {formError && (
                                    <div className="compras-form__error">{formError}</div>
                                )}
                                <div className="compras-grid-3">
                                    <div className="compras-form__group">
                                        <label className="compras-form-label">Proveedor <span className="compras-req"></span></label>
                                        <select className="compras-input" value={formIdProveedor} onChange={(e) => setFormIdProveedor(e.target.value)}>
                                            <option value="">Seleccionar...</option>
                                            {proveedores.map(p => <option key={p.id_proveedor} value={String(p.id_proveedor)}>{p.nombre}</option>)}

                                        </select>
                                    </div>

                                    <div className="compras-form__group">
                                        <label className="compras-form-label">Empresa <span className="compras-req"></span></label>
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
                                            {formDetalle.map((line, idx)=> (
                                                <tr key={idx}>
                                                <td>
                                                    <select className="compras-input" value={formDetalle[0].id_producto} onChange={(e) => handleLineChange(0, 'id_producto', e.target.value)}>
                                                        <option value="">Seleccionar...</option>
                                                        {productos.map(p => <option key={p.id_producto} value={String(p.id_producto)}>{p.nombre}</option>)}
                                                    </select>
                                                </td>
                                                <td><input type="number" className="compras-input" min="1" value={formDetalle[0].cantidad} onChange={(e) => handleLineChange(0, 'cantidad', e.target.value)} /></td>
                                                <td><input type="number" className="compras-input" min="0" step="0.01" value={formDetalle[0].precio_unitario} onChange={(e) => handleLineChange(0, 'precio_unitario', e.target.value)} /></td>
                                                <td>
                                                    <select className="compras-input" value={formDetalle[0].id_departamento} onChange={(e) => handleLineChange(0, 'id_departamento', e.target.value)}>
                                                        <option value="">Seleccionar...</option>
                                                        {departamentos.map(d => <option key={d.id_departamento} value={String(d.id_departamento)}>{d.nombre}</option>)}
                                                    </select>
                                                </td>
                                                <td style={{ textAlign: 'right' }} className="compras-line-subtotal">{formatMoney(formDetalle[0].cantidad * formDetalle[0].precio_unitario)}</td>
                                                <td>
                                                    {formDetalle.length > 1 && (
                                                        <button type="button" className="compras-line-remove" onClick={() => handleRemoveLine(0)} disabled={formDetalle.length === 1}>
                                                            &times;
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
                                        <button type="button" className="compras-btn compras-btn--secondary" onClick={()=> setModalOpen(false)} disabled={actionLoading}>
                                            Cancelar
                                        </button>
                                        <button type="submit" clasName="compras-btn compras-btn--primary" disabled={actionLoading}>
                                            {actionLoading && <span className="compras-btn__spin"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /></svg></span>}
                                            {actionLoading ? 'Procesando...' : "Aceptar"}
                                        </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {(detailCompra || detailLoading) && (
                    <div className="compras-modal-overlay" onClick={() => {setDetailCompra(null); setDetailLoading(false)}}>
                        <div className="compras-modal compras-modal--wide" onClick={e=> e.stopPropagation()}>
                            <div className="compras-modal__header">
                                <h2 className="compras-modal__title">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                    Detalle de Compra {detailCompra && `#${detailCompra.id_compra}`}
                                </h2>
                                <button className="compras-modal__close" onClick={() => {setDetailCompra(null); setDetailLoading(false)}}>&times;</button>
                            </div>
                            {detailLoading ? (
                                <div className="compras-loading" style={{padding: '20px'}}>
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
                                                    <tbody style={{textAlign: 'center'}}>
                                                        {detailCompra.detalle.map((d, i)=> (
                                                            <tr key={i}>
                                                                <td>{d.nombre}</td>
                                                                <td>{d.marca}</td>
                                                                <td>{d.modelo}</td>
                                                                <td>{detailCompra.departamento}</td>
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
                                </>
                            )}
                        </div>
                    </div>
                    
                )}
            </div>
        </Layout>
    )
}
export default Compras