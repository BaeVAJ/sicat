// src/components/Organizacion/Departamento/Departamento.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import Layout from '../../layout/Layout';
import './Departamento.css';

function Departamento() {
    const { usuario } = useAuth();

    const [departamentos, setDepartamentos] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Vista activa por defecto: 'GROUPED' (Por Empresa)
    const [viewMode, setViewMode] = useState('GROUPED');

    // Búsqueda y Filtro por Empresa
    const [search, setSearch] = useState('');
    const [filterEmpresa, setFilterEmpresa] = useState('ALL');

    // Modales
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
    const [currentDepto, setCurrentDepto] = useState(null);

    // Form inputs
    const [nombre, setNombre] = useState('');
    const [idEmpresa, setIdEmpresa] = useState('');

    // Modal de confirmación de eliminación
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deptoToDelete, setDeptoToDelete] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [deptRes, empRes] = await Promise.all([
                client.get('/departamentos'),
                client.get('/empresas'),
            ]);
            setDepartamentos(Array.isArray(deptRes.data) ? deptRes.data : []);
            setEmpresas(Array.isArray(empRes.data) ? empRes.data : []);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cargar los departamentos');
        } finally {
            setLoading(false);
        }
    };

    // Mapa id_empresa -> objeto Empresa
    const empresaMap = useMemo(() => {
        const map = {};
        empresas.forEach((e) => {
            map[e.id_empresa] = e;
        });
        return map;
    }, [empresas]);

    // Abrir modal para crear departamento
    const handleOpenCreate = (preselectedEmpresaId = null) => {
        setModalMode('CREATE');
        setCurrentDepto(null);
        setNombre('');
        if (preselectedEmpresaId) {
            setIdEmpresa(String(preselectedEmpresaId));
        } else if (filterEmpresa !== 'ALL') {
            setIdEmpresa(filterEmpresa);
        } else {
            setIdEmpresa(empresas.length > 0 ? String(empresas[0].id_empresa) : '');
        }
        setError('');
        setModalOpen(true);
    };

    // Abrir modal para editar departamento
    const handleOpenEdit = (depto) => {
        setModalMode('EDIT');
        setCurrentDepto(depto);
        setNombre(depto.nombre || '');
        setIdEmpresa(String(depto.id_empresa));
        setError('');
        setModalOpen(true);
    };

    // Guardar (Crear o Actualizar)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) {
            setError('El nombre del departamento es obligatorio.');
            return;
        }
        if (!idEmpresa) {
            setError('Debes seleccionar una empresa.');
            return;
        }

        setActionLoading(true);
        setError('');
        setSuccess('');

        const payload = {
            nombre: nombre.trim(),
            id_empresa: Number(idEmpresa),
        };

        try {
            if (modalMode === 'CREATE') {
                const { data } = await client.post('/departamentos', payload);
                setDepartamentos((prev) => [...prev, data]);
                setSuccess('Departamento registrado exitosamente.');
            } else {
                const { data } = await client.put(`/departamentos/${currentDepto.id_departamento}`, payload);
                setDepartamentos((prev) =>
                    prev.map((d) => (d.id_departamento === currentDepto.id_departamento ? data : d))
                );
                setSuccess('Departamento actualizado exitosamente.');
            }
            setModalOpen(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al guardar el departamento');
        } finally {
            setActionLoading(false);
        }
    };

    // Abrir modal de eliminación
    const handleOpenDelete = (depto) => {
        setDeptoToDelete(depto);
        setDeleteModalOpen(true);
    };

    // Confirmar eliminación
    const handleConfirmDelete = async () => {
        if (!deptoToDelete) return;
        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            await client.delete(`/departamentos/${deptoToDelete.id_departamento}`);
            setDepartamentos((prev) => prev.filter((d) => d.id_departamento !== deptoToDelete.id_departamento));
            setSuccess('Departamento eliminado exitosamente.');
            setDeleteModalOpen(false);
            setDeptoToDelete(null);
        } catch (err) {
            setError(err.response?.data?.error || 'No se puede eliminar. Podría tener usuarios o inventario vinculado.');
        } finally {
            setActionLoading(false);
        }
    };

    // Departamentos filtrados
    const deptosFiltrados = useMemo(() => {
        return departamentos.filter((d) => {
            const empNombre = empresaMap[d.id_empresa]?.nombre || '';
            const matchSearch =
                (d.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
                empNombre.toLowerCase().includes(search.toLowerCase());

            if (!matchSearch) return false;
            if (filterEmpresa !== 'ALL') return String(d.id_empresa) === filterEmpresa;
            return true;
        });
    }, [departamentos, search, filterEmpresa, empresaMap]);

    // Métricas compactas
    const totalCount = departamentos.length;
    const empresasConDeptosCount = new Set(departamentos.map((d) => d.id_empresa)).size;

    // Agrupación de departamentos por empresa
    const groupedData = useMemo(() => {
        const list = filterEmpresa === 'ALL'
            ? empresas
            : empresas.filter((e) => String(e.id_empresa) === filterEmpresa);

        return list.map((emp) => {
            const deptos = deptosFiltrados.filter((d) => d.id_empresa === emp.id_empresa);
            return {
                empresa: emp,
                departamentos: deptos,
            };
        });
    }, [empresas, deptosFiltrados, filterEmpresa]);

    return (
        <Layout>
            <div className="depto-page">
                {/* ── Header ── */}
                <div className="depto-header">
                    <div>
                        <h1 className="depto-header__title">
                            Departamentos
                        </h1>
                    </div>

                    <div className="depto-header__actions">
                        <button
                            type="button"
                            className="depto-btn depto-btn--secondary"
                            onClick={fetchData}
                            disabled={loading}
                        >
                            <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={loading ? 'depto-btn__spin' : ''}
                            >
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            <span>Refrescar</span>
                        </button>

                        {usuario?.rol === 'admin' && (
                            <button
                                type="button"
                                className="depto-btn depto-btn--primary"
                                onClick={() => handleOpenCreate()}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Nuevo Departamento</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Compact Non-Invasive Metrics ── */}
                <div className="depto-metrics-bar">
                    <span className="depto-metric-pill">
                        Departamentos: <strong>{totalCount}</strong>
                    </span>
                    <span className="depto-metric-pill depto-metric-pill--purple">
                        Empresas con áreas: <strong>{empresasConDeptosCount} / {empresas.length}</strong>
                    </span>
                </div>

                {/* ── Alerts ── */}
                {error && (
                    <div className="depto-alert depto-alert--error" role="alert">
                        <div className="depto-alert__content">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                            <span>{error}</span>
                        </div>
                        <button type="button" className="depto-alert__close" onClick={() => setError('')} aria-label="Cerrar alerta">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {success && (
                    <div className="depto-alert depto-alert--success" role="alert">
                        <div className="depto-alert__content">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <span>{success}</span>
                        </div>
                        <button type="button" className="depto-alert__close" onClick={() => setSuccess('')} aria-label="Cerrar notificación">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* ── Controls Toolbar ── */}
                <div className="depto-toolbar">
                    <div className="depto-toolbar__search-box">
                        <span className="depto-toolbar__search-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="depto-toolbar__search-input"
                            placeholder="Buscar departamento o empresa..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* View Switcher */}
                    <div className="depto-view-switch">
                        <button
                            type="button"
                            className={`depto-view-switch__btn ${viewMode === 'GROUPED' ? 'depto-view-switch__btn--active' : ''}`}
                            onClick={() => setViewMode('GROUPED')}
                            title="Vista Agrupada por Empresa"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                <polyline points="2 17 12 22 22 17" />
                                <polyline points="2 12 12 17 22 12" />
                            </svg>
                            <span>Por Empresa</span>
                        </button>

                        <button
                            type="button"
                            className={`depto-view-switch__btn ${viewMode === 'GRID' ? 'depto-view-switch__btn--active' : ''}`}
                            onClick={() => setViewMode('GRID')}
                            title="Vista Mosaico"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" />
                                <rect x="14" y="14" width="7" height="7" rx="1" />
                            </svg>
                            <span>Tarjetas</span>
                        </button>

                        <button
                            type="button"
                            className={`depto-view-switch__btn ${viewMode === 'TABLE' ? 'depto-view-switch__btn--active' : ''}`}
                            onClick={() => setViewMode('TABLE')}
                            title="Vista Tabla"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6" />
                                <line x1="8" y1="12" x2="21" y2="12" />
                                <line x1="8" y1="18" x2="21" y2="18" />
                                <line x1="3" y1="6" x2="3.01" y2="6" />
                                <line x1="3" y1="12" x2="3.01" y2="12" />
                                <line x1="3" y1="18" x2="3.01" y2="18" />
                            </svg>
                            <span>Lista</span>
                        </button>
                    </div>
                </div>

                {/* ── Company Filter Pills Strip ── */}
                <div className="depto-pills">
                    <button
                        type="button"
                        className={`depto-pill ${filterEmpresa === 'ALL' ? 'depto-pill--active' : ''}`}
                        onClick={() => setFilterEmpresa('ALL')}
                    >
                        <span>Todas</span>
                        <span className="depto-pill__count">{departamentos.length}</span>
                    </button>

                    {empresas.map((emp) => {
                        const count = departamentos.filter((d) => d.id_empresa === emp.id_empresa).length;
                        return (
                            <button
                                key={emp.id_empresa}
                                type="button"
                                className={`depto-pill ${filterEmpresa === String(emp.id_empresa) ? 'depto-pill--active' : ''}`}
                                onClick={() => setFilterEmpresa(String(emp.id_empresa))}
                            >
                                <span>{emp.nombre}</span>
                                <span className="depto-pill__count">{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ── CONTENT VIEWS ── */}
                {loading ? (
                    <div className="depto-empty-state">
                        <div className="depto-empty-state__icon">
                            <span className="depto-btn__spin">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="23 4 23 10 17 10" />
                                    <polyline points="1 20 1 14 7 14" />
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                </svg>
                            </span>
                        </div>
                        <h3 className="depto-empty-state__title">Cargando departamentos...</h3>
                    </div>
                ) : deptosFiltrados.length === 0 ? (
                    <div className="depto-empty-state">
                        <div className="depto-empty-state__icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </div>
                        <h3 className="depto-empty-state__title">No se encontraron departamentos</h3>
                        <p className="depto-empty-state__desc">
                            {search || filterEmpresa !== 'ALL'
                                ? 'No hay departamentos que coincidan con la búsqueda o filtro.'
                                : 'Aún no hay departamentos registrados.'}
                        </p>
                        {usuario?.rol === 'admin' && (
                            <button
                                type="button"
                                className="depto-btn depto-btn--primary"
                                onClick={() => handleOpenCreate()}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Crear Departamento</span>
                            </button>
                        )}
                    </div>
                ) : viewMode === 'GROUPED' ? (
                    /* ── VISTA DEFAULT: AGRUPADO POR EMPRESA ── */
                    <div className="depto-grouped-list">
                        {groupedData.map(({ empresa, departamentos: deptos }) => (
                            <div key={empresa.id_empresa} className="depto-company-group">
                                <div className="depto-company-group__header">
                                    <div className="depto-company-group__title-wrap">
                                        <div className="depto-company-group__icon">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                                                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                                                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="depto-company-group__name">{empresa.nombre}</h3>
                                            <span className="depto-company-group__sub">
                                                {empresa.rfc ? `RFC: ${empresa.rfc}` : 'Sin RFC'}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <span className="depto-company-group__badge">
                                            {deptos.length} {deptos.length === 1 ? 'área' : 'áreas'}
                                        </span>

                                        {usuario?.rol === 'admin' && (
                                            <button
                                                type="button"
                                                className="depto-btn depto-btn--secondary"
                                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                                                onClick={() => handleOpenCreate(empresa.id_empresa)}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <line x1="12" y1="5" x2="12" y2="19" />
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                                <span>Añadir</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {deptos.length === 0 ? (
                                    <div className="depto-company-group__empty">
                                        No hay departamentos asociados a esta empresa
                                    </div>
                                ) : (
                                    <div className="depto-company-group__grid">
                                        {deptos.map((d) => (
                                            <div key={d.id_departamento} className="depto-mini-card">
                                                <div>
                                                    <h4 className="depto-mini-card__title">{d.nombre}</h4>
                                                    <span className="depto-mini-card__id">ID #{d.id_departamento}</span>
                                                </div>

                                                {usuario?.rol === 'admin' && (
                                                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                        <button
                                                            type="button"
                                                            className="depto-action-btn depto-action-btn--edit"
                                                            onClick={() => handleOpenEdit(d)}
                                                            disabled={actionLoading}
                                                            title="Editar"
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="depto-action-btn depto-action-btn--delete"
                                                            onClick={() => handleOpenDelete(d)}
                                                            disabled={actionLoading}
                                                            title="Eliminar"
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6" />
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : viewMode === 'GRID' ? (
                    /* ── VISTA 2: MOSAICO / GRID CARDS ── */
                    <div className="depto-grid">
                        {deptosFiltrados.map((depto) => {
                            const emp = empresaMap[depto.id_empresa];
                            return (
                                <div key={depto.id_departamento} className="depto-card">
                                    <div className="depto-card__top">
                                        <h3 className="depto-card__name">{depto.nombre}</h3>
                                        <span className="depto-card__id">#{depto.id_departamento}</span>
                                    </div>

                                    <div>
                                        <div className="depto-card__company">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                                                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                                                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                                            </svg>
                                            <span>{emp?.nombre || `Empresa #${depto.id_empresa}`}</span>
                                        </div>
                                    </div>

                                    {usuario?.rol === 'admin' && (
                                        <div className="depto-card__footer">
                                            <button
                                                type="button"
                                                className="depto-action-btn depto-action-btn--edit"
                                                onClick={() => handleOpenEdit(depto)}
                                                disabled={actionLoading}
                                                title="Editar departamento"
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                                <span>Editar</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="depto-action-btn depto-action-btn--delete"
                                                onClick={() => handleOpenDelete(depto)}
                                                disabled={actionLoading}
                                                title="Eliminar departamento"
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                                <span>Eliminar</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* ── VISTA 3: TABLA DETALLADA ── */
                    <div className="depto-table-wrap">
                        <table className="depto-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Departamento</th>
                                    <th>Empresa Perteneciente</th>
                                    {usuario?.rol === 'admin' && <th>Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {deptosFiltrados.map((depto) => (
                                    <tr key={depto.id_departamento}>
                                        <td className="depto-table__id">#{depto.id_departamento}</td>
                                        <td className="depto-table__name">{depto.nombre}</td>
                                        <td>
                                            <span className="depto-card__company">
                                                {empresaMap[depto.id_empresa]?.nombre || `Empresa #${depto.id_empresa}`}
                                            </span>
                                        </td>
                                        {usuario?.rol === 'admin' && (
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <button
                                                        type="button"
                                                        className="depto-action-btn depto-action-btn--edit"
                                                        onClick={() => handleOpenEdit(depto)}
                                                        disabled={actionLoading}
                                                        title="Editar departamento"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="depto-action-btn depto-action-btn--delete"
                                                        onClick={() => handleOpenDelete(depto)}
                                                        disabled={actionLoading}
                                                        title="Eliminar departamento"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Modal: Create / Edit ── */}
                {modalOpen && (
                    <div className="depto-modal-overlay">
                        <div className="depto-modal">
                            <div className="depto-modal__header">
                                <h2 className="depto-modal__title">
                                    {modalMode === 'CREATE' ? 'Nuevo Departamento' : 'Editar Departamento'}
                                </h2>
                                <button
                                    type="button"
                                    className="depto-modal__close"
                                    onClick={() => setModalOpen(false)}
                                    disabled={actionLoading}
                                    aria-label="Cerrar modal"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="depto-form-group">
                                    <label className="depto-form-label">Nombre del Departamento *</label>
                                    <input
                                        type="text"
                                        className="depto-form-input"
                                        placeholder="Ej. Tecnologías de la Información, Recursos Humanos..."
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="depto-form-group">
                                    <label className="depto-form-label">Empresa Perteneciente *</label>
                                    <select
                                        className="depto-form-input"
                                        value={idEmpresa}
                                        onChange={(e) => setIdEmpresa(e.target.value)}
                                        required
                                    >
                                        <option value="">Selecciona una empresa</option>
                                        {empresas.map((emp) => (
                                            <option key={emp.id_empresa} value={emp.id_empresa}>
                                                {emp.nombre} {emp.rfc ? `(${emp.rfc})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="depto-modal__footer">
                                    <button
                                        type="button"
                                        className="depto-btn depto-btn--secondary"
                                        onClick={() => setModalOpen(false)}
                                        disabled={actionLoading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="depto-btn depto-btn--primary"
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? (
                                            <>
                                                <span className="depto-btn__spin">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="23 4 23 10 17 10" />
                                                        <polyline points="1 20 1 14 7 14" />
                                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                                    </svg>
                                                </span>
                                                <span>Guardando...</span>
                                            </>
                                        ) : (
                                            <span>{modalMode === 'CREATE' ? 'Crear Departamento' : 'Guardar Cambios'}</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Modal: Delete Confirmation ── */}
                {deleteModalOpen && deptoToDelete && (
                    <div className="depto-modal-overlay">
                        <div className="depto-modal" style={{ maxWidth: '400px' }}>
                            <div className="depto-modal__header">
                                <h2 className="depto-modal__title" style={{ color: '#fca5a5' }}>
                                    Confirmar Eliminación
                                </h2>
                                <button
                                    type="button"
                                    className="depto-modal__close"
                                    onClick={() => setDeleteModalOpen(false)}
                                    disabled={actionLoading}
                                    aria-label="Cerrar modal"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: '1.5', margin: '0.4rem 0 1.25rem' }}>
                                ¿Deseas eliminar el departamento{' '}
                                <strong style={{ color: '#f1f5f9' }}>{deptoToDelete.nombre}</strong> de{' '}
                                <strong style={{ color: '#22d3ee' }}>
                                    {empresaMap[deptoToDelete.id_empresa]?.nombre || 'su empresa'}
                                </strong>?
                            </p>

                            <div className="depto-modal__footer">
                                <button
                                    type="button"
                                    className="depto-btn depto-btn--secondary"
                                    onClick={() => setDeleteModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="depto-btn depto-btn--danger"
                                    onClick={handleConfirmDelete}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'Eliminando...' : 'Eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

export default Departamento;
