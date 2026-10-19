// src/components/Operaciones/Asignaciones/Asignaciones.jsx
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import Layout from '../../layout/Layout';
import './Asignaciones.css';

function Asignaciones() {
    const { usuario } = useAuth();
    const location = useLocation();

    const [asignaciones, setAsignaciones] = useState([]);
    const [inventario, setInventario] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Filters
    const [search, setSearch] = useState('');
    const [filterEstatus, setFilterEstatus] = useState('ALL'); // ALL | ACTIVO | DEVUELTO
    const [filterDepto, setFilterDepto] = useState('ALL');

    // Create Modal
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [formIdInventario, setFormIdInventario] = useState('');
    const [formIdDepartamento, setFormIdDepartamento] = useState('');
    const [formCondicion, setFormCondicion] = useState('Excelente');
    const [formError, setFormError] = useState('');

    // Return Modal
    const [returnItem, setReturnItem] = useState(null);
    const [returnCondicion, setReturnCondicion] = useState('');

    const isAdmin = usuario?.rol === 'admin';
    const isGerente = usuario?.rol === 'gerente';
    const canManage = isAdmin || isGerente;

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const pedido = location.state?.pedido;
        if (!pedido || inventario.length === 0 || departamentos.length === 0) return;
        const inv = inventario.find((item) => String(item.id_producto) === String(pedido.id_producto) && Number(item.cantidad_disponible) > 0);
        queueMicrotask(() => {
            setFormIdInventario(inv ? String(inv.id_inventario) : '');
            setFormIdDepartamento(String(pedido.id_departamento || ''));
            setFormCondicion(`Solicitud #${pedido.id_pedido}`);
            setFormError(inv ? '' : 'La solicitud no tiene stock disponible para asignar.');
            setCreateModalOpen(true);
        });
    }, [location.state, inventario, departamentos]);

    useEffect(() => {
        if (success) {
            const t = setTimeout(() => setSuccess(''), 4000);
            return () => clearTimeout(t);
        }
    }, [success]);

    async function fetchData() {
        setLoading(true);
        setError('');
        try {
            const [asigRes, invRes, deptRes] = await Promise.all([
                client.get('/asignaciones'),
                client.get('/inventario').catch(() => ({ data: [] })),
                client.get('/departamentos').catch(() => ({ data: [] })),
            ]);
            setAsignaciones(Array.isArray(asigRes.data) ? asigRes.data : []);
            setInventario(Array.isArray(invRes.data) ? invRes.data : []);
            setDepartamentos(Array.isArray(deptRes.data) ? deptRes.data : []);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cargar las asignaciones.');
        } finally {
            setLoading(false);
        }
    }

    // Filtered list
    const filteredAsignaciones = useMemo(() => {
        return asignaciones.filter((item) => {
            const matchesSearch =
                (item.producto || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.marca || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.departamento || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.condicion || '').toLowerCase().includes(search.toLowerCase()) ||
                String(item.id_asignacion || '').includes(search);

            const matchesEstatus =
                filterEstatus === 'ALL' || item.estatus === filterEstatus;

            const matchesDepto =
                filterDepto === 'ALL' || String(item.id_departamento) === String(filterDepto);

            return matchesSearch && matchesEstatus && matchesDepto;
        });
    }, [asignaciones, search, filterEstatus, filterDepto]);

    // Available inventory items (with stock > 0)
    const availableInventory = useMemo(() => {
        return inventario.filter((inv) => Number(inv.cantidad_disponible) > 0);
    }, [inventario]);

    // Selected inventory item details in create form
    const selectedInvItem = useMemo(() => {
        return inventario.find((i) => String(i.id_inventario) === String(formIdInventario));
    }, [inventario, formIdInventario]);

    // KPIs
    const kpis = useMemo(() => {
        const total = asignaciones.length;
        const activas = asignaciones.filter((a) => a.estatus === 'ACTIVO').length;
        const devueltas = asignaciones.filter((a) => a.estatus === 'DEVUELTO').length;
        const deptosSet = new Set(asignaciones.map((a) => a.id_departamento));
        return { total, activas, devueltas, deptos: deptosSet.size };
    }, [asignaciones]);

    // Handlers
    const handleOpenCreateModal = () => {
        setFormIdInventario('');
        setFormIdDepartamento('');
        setFormCondicion('Excelente');
        setFormError('');
        setCreateModalOpen(true);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!formIdInventario) {
            setFormError('Debes seleccionar un producto del inventario.');
            return;
        }
        if (!formIdDepartamento) {
            setFormError('Debes seleccionar el departamento asignado.');
            return;
        }

        setActionLoading(true);
        try {
            await client.post('/asignaciones', {
                id_inventario: Number(formIdInventario),
                id_departamento: Number(formIdDepartamento),
                condicion: formCondicion.trim() || 'Bueno',
            });

            setSuccess('¡Asignación registrada exitosamente! El stock fue actualizado.');
            setCreateModalOpen(false);
            fetchData();
        } catch (err) {
            setFormError(err.response?.data?.error || 'Error al registrar la asignación.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenReturnModal = (item) => {
        setReturnItem(item);
        setReturnCondicion(item.condicion || 'Bueno');
    };

    const handleReturnConfirm = async () => {
        if (!returnItem) return;
        setActionLoading(true);
        try {
            await client.patch(`/asignaciones/${returnItem.id_asignacion}/devolver`, {
                condicion: returnCondicion.trim() || undefined,
            });

            setSuccess('¡Devolución registrada correctamente! Se descontó del departamento prestatario y se reincorporó al stock de origen.');
            setReturnItem(null);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al registrar la devolución.');
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (val) => {
        if (!val) return '—';
        try {
            return new Date(val).toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
            });
        } catch {
            return val;
        }
    };

    return (
        <Layout>
            <div className="asig-container">
                {/* Header */}
                <div className="asig-header">
                    <div>
                        <h1 className="asig-header__title">
                            <span className="asig-header__icon-box">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <line x1="19" y1="8" x2="19" y2="14" />
                                    <line x1="22" y1="11" x2="16" y2="11" />
                                </svg>
                            </span>
                            Asignaciones
                        </h1>
                        <p className="asig-header__subtitle">
                            Control y seguimiento de asignaciones de equipos y bienes a departamentos
                        </p>
                    </div>

                    <div className="asig-header__actions">
                        <button
                            type="button"
                            className="asig-btn asig-btn--secondary asig-btn--icon-only"
                            onClick={fetchData}
                            title="Recargar datos"
                            disabled={loading}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                            </svg>
                        </button>

                        {canManage && (
                            <button
                                type="button"
                                className="asig-btn asig-btn--primary"
                                onClick={handleOpenCreateModal}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Nueva Asignación
                            </button>
                        )}
                    </div>
                </div>

                {/* Notifications */}
                {error && (
                    <div className="asig-alert asig-alert--error">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="asig-alert asig-alert--success">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span>{success}</span>
                    </div>
                )}

                {/* KPIs Cards */}
                <div className="asig-kpis">
                    <div className="asig-kpi">
                        <div className="asig-kpi__icon-box asig-kpi__icon-box--emerald">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                            </svg>
                        </div>
                        <div className="asig-kpi__content">
                            <div className="asig-kpi__label">Total Asignaciones</div>
                            <div className="asig-kpi__value">{kpis.total}</div>
                        </div>
                    </div>

                    <div className="asig-kpi">
                        <div className="asig-kpi__icon-box asig-kpi__icon-box--green">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 14 14" />
                            </svg>
                        </div>
                        <div className="asig-kpi__content">
                            <div className="asig-kpi__label">Activas / En Uso</div>
                            <div className="asig-kpi__value">{kpis.activas}</div>
                        </div>
                    </div>

                    <div className="asig-kpi">
                        <div className="asig-kpi__icon-box asig-kpi__icon-box--amber">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 11 12 14 22 4" />
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                            </svg>
                        </div>
                        <div className="asig-kpi__content">
                            <div className="asig-kpi__label">Devueltas</div>
                            <div className="asig-kpi__value">{kpis.devueltas}</div>
                        </div>
                    </div>

                    <div className="asig-kpi">
                        <div className="asig-kpi__icon-box asig-kpi__icon-box--blue">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                        </div>
                        <div className="asig-kpi__content">
                            <div className="asig-kpi__label">Deptos Involucrados</div>
                            <div className="asig-kpi__value">{kpis.deptos}</div>
                        </div>
                    </div>
                </div>

                {/* Filter / Search Bar */}
                <div className="asig-controls">
                    <div className="asig-search">
                        <span className="asig-search__icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="asig-search__input"
                            placeholder="Buscar por producto, marca, departamento o condición..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="asig-filters">
                        <select
                            className="asig-select"
                            value={filterEstatus}
                            onChange={(e) => setFilterEstatus(e.target.value)}
                        >
                            <option value="ALL">Todos los Estados</option>
                            <option value="ACTIVO">Solo Activos</option>
                            <option value="DEVUELTO">Solo Devueltos</option>
                        </select>

                        <select
                            className="asig-select"
                            value={filterDepto}
                            onChange={(e) => setFilterDepto(e.target.value)}
                        >
                            <option value="ALL">Todos los Departamentos</option>
                            {departamentos.map((d) => (
                                <option key={d.id_departamento} value={d.id_departamento}>
                                    {d.nombre}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="asig-table-wrapper">
                    <div className="asig-table-scroll">
                        <table className="asig-table">
                            <thead>
                                <tr>
                                    <th># ID</th>
                                    <th>Producto</th>
                                    <th>Departamento</th>
                                    <th>Fecha Asignación</th>
                                    <th>Fecha Devolución</th>
                                    <th>Condición</th>
                                    <th>Estado</th>
                                    {canManage && <th style={{ textAlign: 'right' }}>Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={canManage ? 8 : 7} style={{ textAlign: 'center', padding: '3rem' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', color: '#94a3b8' }}>
                                                <svg style={{ animation: 'spin 1s linear infinite' }} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                                                </svg>
                                                Cargando asignaciones...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredAsignaciones.length === 0 ? (
                                    <tr>
                                        <td colSpan={canManage ? 8 : 7}>
                                            <div className="asig-empty">
                                                <div className="asig-empty__icon">
                                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                                        <circle cx="9" cy="7" r="4" />
                                                        <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                                                    </svg>
                                                </div>
                                                <div className="asig-empty__title">No se encontraron asignaciones</div>
                                                <div className="asig-empty__desc">
                                                    {search || filterEstatus !== 'ALL' || filterDepto !== 'ALL'
                                                        ? 'Intenta ajustar los criterios de búsqueda o filtros.'
                                                        : 'Aún no hay asignaciones registradas en el sistema.'}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAsignaciones.map((asig) => {
                                        const isActivo = asig.estatus === 'ACTIVO';
                                        return (
                                            <tr key={asig.id_asignacion}>
                                                <td style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                                                    #{asig.id_asignacion}
                                                </td>
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
                                                    <span className="asig-dept-tag">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                                        </svg>
                                                        {asig.departamento_origen && asig.departamento_origen !== asig.departamento
                                                            ? `${asig.departamento_origen} → ${asig.departamento}`
                                                            : (asig.departamento || 'Sin Depto')}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#cbd5e1' }}>
                                                    {formatDate(asig.fecha_asignacion)}
                                                </td>
                                                <td style={{ color: asig.fecha_devolucion ? '#94a3b8' : '#64748b' }}>
                                                    {formatDate(asig.fecha_devolucion)}
                                                </td>
                                                <td>
                                                    <span className="asig-condition-pill" title={asig.condicion}>
                                                        {asig.condicion || '—'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`asig-badge asig-badge--dot ${isActivo ? 'asig-badge--active' : 'asig-badge--returned'}`}>
                                                        {isActivo ? 'ACTIVO' : 'DEVUELTO'}
                                                    </span>
                                                </td>
                                                {canManage && (
                                                    <td style={{ textAlign: 'right' }}>
                                                        {isActivo ? (
                                                            <button
                                                                type="button"
                                                                className="asig-btn asig-btn--return"
                                                                onClick={() => handleOpenReturnModal(asig)}
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <polyline points="9 14 4 9 9 4" />
                                                                    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                                                                </svg>
                                                                Devolver
                                                            </button>
                                                        ) : (
                                                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                                                                Completado
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
                            Mostrando <strong>{filteredAsignaciones.length}</strong> de <strong>{asignaciones.length}</strong> registros
                        </span>
                        {filterEstatus !== 'ALL' && (
                            <span>Filtro activo: {filterEstatus}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Nueva Asignación */}
            {createModalOpen && (
                <div className="asig-modal-overlay" onClick={() => !actionLoading && setCreateModalOpen(false)}>
                    <div className="asig-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="asig-modal__header">
                            <h2 className="asig-modal__title">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Nueva Asignación
                            </h2>
                            <button
                                type="button"
                                className="asig-modal__close"
                                onClick={() => setCreateModalOpen(false)}
                                disabled={actionLoading}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleCreate}>
                            <div className="asig-modal__body">
                                {formError && (
                                    <div className="asig-alert asig-alert--error" style={{ marginBottom: 0 }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        <span>{formError}</span>
                                    </div>
                                )}

                                <div className="asig-form-group">
                                    <label className="asig-label">
                                        Producto en Inventario *
                                        <span className="asig-hint">
                                            {availableInventory.length} disponibles con stock
                                        </span>
                                    </label>
                                    <select
                                        className="asig-select"
                                        style={{ width: '100%' }}
                                        value={formIdInventario}
                                        onChange={(e) => setFormIdInventario(e.target.value)}
                                        required
                                    >
                                        <option value="">-- Selecciona un item del inventario --</option>
                                        {availableInventory.map((inv) => (
                                            <option key={inv.id_inventario} value={inv.id_inventario}>
                                                {inv.producto} {inv.marca ? `(${inv.marca})` : ''} — Stock disp: {inv.cantidad_disponible} (Depto: {inv.departamento || 'General'})
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
                                        <div><strong>Producto:</strong> {selectedInvItem.producto} {selectedInvItem.marca && `(${selectedInvItem.marca})`}</div>
                                        <div><strong>Ubicación actual:</strong> {selectedInvItem.departamento || 'Sin asignar'} {selectedInvItem.empresa && `• ${selectedInvItem.empresa}`}</div>
                                        <div><strong>Stock disponible antes de asignar:</strong> {selectedInvItem.cantidad_disponible} unidad(es)</div>
                                        <div style={{ color: '#34d399', marginTop: '0.3rem', fontSize: '0.78rem' }}>
                                            * Se transferirá 1 unidad del stock de {selectedInvItem.departamento || 'origen'} al departamento destino al confirmar.
                                        </div>
                                    </div>
                                )}

                                <div className="asig-form-group">
                                    <label className="asig-label">
                                        Departamento Destino *
                                    </label>
                                    <select
                                        className="asig-select"
                                        style={{ width: '100%' }}
                                        value={formIdDepartamento}
                                        onChange={(e) => setFormIdDepartamento(e.target.value)}
                                        required
                                    >
                                        <option value="">-- Selecciona el departamento destino --</option>
                                        {departamentos.map((d) => (
                                            <option key={d.id_departamento} value={d.id_departamento}>
                                                {d.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="asig-form-group">
                                    <label className="asig-label">
                                        Condición del Bien / Observaciones
                                    </label>
                                    <input
                                        type="text"
                                        className="asig-input"
                                        placeholder="Ej: Nuevo, Excelente, En buen estado, Con cargador..."
                                        value={formCondicion}
                                        onChange={(e) => setFormCondicion(e.target.value)}
                                    />
                                    <span className="asig-hint">
                                        Estado físico o notas iniciales del equipo al momento de la entrega.
                                    </span>
                                </div>
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
                                    type="submit"
                                    className="asig-btn asig-btn--primary"
                                    disabled={actionLoading || !formIdInventario || !formIdDepartamento}
                                >
                                    {actionLoading ? 'Asignando...' : 'Confirmar Asignación'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Confirmar Devolución */}
            {returnItem && (
                <div className="asig-modal-overlay" onClick={() => !actionLoading && setReturnItem(null)}>
                    <div className="asig-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="asig-modal__header">
                            <h2 className="asig-modal__title">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
                                    <polyline points="9 14 4 9 9 4" />
                                    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                                </svg>
                                Registrar Devolución
                            </h2>
                            <button
                                type="button"
                                className="asig-modal__close"
                                onClick={() => setReturnItem(null)}
                                disabled={actionLoading}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="asig-modal__body">
                            <div className="asig-preview-box">
                                <div><strong>Asignación:</strong> #{returnItem.id_asignacion}</div>
                                <div><strong>Producto:</strong> {returnItem.producto} {returnItem.marca && `(${returnItem.marca})`}</div>
                                <div><strong>Departamento:</strong> {returnItem.departamento}</div>
                                <div><strong>Fecha de asignación:</strong> {formatDate(returnItem.fecha_asignacion)}</div>
                                <div style={{ color: '#fbbf24', marginTop: '0.4rem', fontSize: '0.78rem' }}>
                                    * El estado cambiará a DEVUELTO y se reincorporará 1 unidad al stock de inventario.
                                </div>
                            </div>

                            <div className="asig-form-group">
                                <label className="asig-label">
                                    Condición de Devolución
                                </label>
                                <input
                                    type="text"
                                    className="asig-input"
                                    placeholder="Ej: Bueno, Completo, Con desgaste leve, En caja original..."
                                    value={returnCondicion}
                                    onChange={(e) => setReturnCondicion(e.target.value)}
                                />
                                <span className="asig-hint">
                                    Puedes actualizar el estado físico en que se entrega el producto devuelto.
                                </span>
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
                                className="asig-btn asig-btn--primary"
                                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)' }}
                                onClick={handleReturnConfirm}
                                disabled={actionLoading}
                            >
                                {actionLoading ? 'Procesando...' : 'Confirmar Devolución'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default Asignaciones;
