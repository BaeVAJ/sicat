// src/components/catalogo/Categorias/Categorias.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import Layout from '../../layout/Layout';
import './Categorias.css';

function Categorias() {
    const { usuario } = useAuth();

    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Filters
    const [search, setSearch] = useState('');
    const [filterTipo, setFilterTipo] = useState('ALL'); // ALL | equipo | insumo | accesorio

    // Modal Create / Edit
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
    const [selectedCat, setSelectedCat] = useState(null);
    const [formNombre, setFormNombre] = useState('');
    const [formTipo, setFormTipo] = useState('equipo');
    const [formDescripcion, setFormDescripcion] = useState('');
    const [formError, setFormError] = useState('');

    // Modal Delete
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [catToDelete, setCatToDelete] = useState(null);

    const isAdmin = usuario?.rol === 'admin';

    useEffect(() => {
        fetchCategorias();
    }, []);

    useEffect(() => {
        if (success) {
            const t = setTimeout(() => setSuccess(''), 4000);
            return () => clearTimeout(t);
        }
    }, [success]);

    const fetchCategorias = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await client.get('/categorias');
            setCategorias(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cargar las categorías');
        } finally {
            setLoading(false);
        }
    };

    // Filtered list
    const filteredCategorias = useMemo(() => {
        return categorias.filter((c) => {
            const matchesSearch =
                (c.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
                (c.descripcion || '').toLowerCase().includes(search.toLowerCase()) ||
                String(c.id_categoria || '').includes(search);

            const matchesTipo =
                filterTipo === 'ALL' || (c.tipo || '').toLowerCase() === filterTipo.toLowerCase();

            return matchesSearch && matchesTipo;
        });
    }, [categorias, search, filterTipo]);

    // KPIs
    const kpis = useMemo(() => {
        const total = categorias.length;
        const equipos = categorias.filter((c) => (c.tipo || '').toLowerCase() === 'equipo').length;
        const insumos = categorias.filter((c) => (c.tipo || '').toLowerCase() === 'insumo').length;
        const accesorios = categorias.filter((c) => (c.tipo || '').toLowerCase() === 'accesorio').length;
        return { total, equipos, insumos, accesorios };
    }, [categorias]);

    // Handlers
    const handleOpenCreate = () => {
        setModalMode('CREATE');
        setSelectedCat(null);
        setFormNombre('');
        setFormTipo('equipo');
        setFormDescripcion('');
        setFormError('');
        setModalOpen(true);
    };

    const handleOpenEdit = (cat) => {
        setModalMode('EDIT');
        setSelectedCat(cat);
        setFormNombre(cat.nombre || '');
        setFormTipo((cat.tipo || 'equipo').toLowerCase());
        setFormDescripcion(cat.descripcion || '');
        setFormError('');
        setModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!formNombre.trim()) {
            setFormError('El nombre de la categoría es obligatorio.');
            return;
        }

        setActionLoading(true);
        try {
            if (modalMode === 'CREATE') {
                await client.post('/categorias', {
                    nombre: formNombre.trim(),
                    tipo: formTipo,
                    descripcion: formDescripcion.trim() || null,
                });
                setSuccess('Categoría creada exitosamente.');
            } else {
                await client.put(`/categorias/${selectedCat.id_categoria}`, {
                    nombre: formNombre.trim(),
                    tipo: formTipo,
                    descripcion: formDescripcion.trim() || null,
                });
                setSuccess('Categoría actualizada exitosamente.');
            }
            setModalOpen(false);
            fetchCategorias();
        } catch (err) {
            setFormError(err.response?.data?.error || 'Error al guardar la categoría.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenDelete = (cat) => {
        setCatToDelete(cat);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!catToDelete) return;
        setActionLoading(true);
        try {
            await client.delete(`/categorias/${catToDelete.id_categoria}`);
            setSuccess('Categoría eliminada correctamente.');
            setDeleteModalOpen(false);
            setCatToDelete(null);
            fetchCategorias();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al eliminar la categoría.');
            setDeleteModalOpen(false);
        } finally {
            setActionLoading(false);
        }
    };

    const totalCategorias = categorias.length;
    const categoriaEquipos = categorias.filter((c) => (c.tipo || '').toLowerCase() === 'equipo').length;
    const categoriaInsumos = categorias.filter((c) => (c.tipo || '').toLowerCase() === 'insumo').length;
    const categoriaAccesorios = categorias.filter((c) => (c.tipo || '').toLowerCase() === 'accesorio').length;

    return (
        <Layout>
            <div className="cat-container">
                <div className="cat-header">
                    <div>
                        <h1 className="cat-header__title">
                            <span className="cat-header__icon-box">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                                    <path d="M7 7h.01" />
                                </svg>
                            </span>
                            Categorías
                        </h1>
                        <p className="cat-header__subtitle">
                            Clasificación de productos, insumos y accesorios del catálogo
                        </p>
                    </div>

                    <div className="cat-header__actions">
                        <button
                            type="button"
                            className="cat-btn cat-btn--secondary cat-btn--icon-only"
                            onClick={fetchCategorias}
                            title="Recargar categorías"
                            disabled={loading}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                            </svg>
                        </button>

                        {isAdmin && (
                            <button
                                type="button"
                                className="cat-btn cat-btn--primary"
                                onClick={handleOpenCreate}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Nueva Categoría
                            </button>
                        )}
                    </div>
                </div>

                <div className="cat-kpis">
                    <div className="cat-kpi" onClick={()=> setFilterTipo('ALL')}>
                        <span className="cat-kpi__icon-box cat-kpi__icon-box--violet">
                            <svg width="30px" height="30px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M7.0498 7.0498H7.0598M10.5118 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V10.5118C3 11.2455 3 11.6124 3.08289 11.9577C3.15638 12.2638 3.27759 12.5564 3.44208 12.8249C3.6276 13.1276 3.88703 13.387 4.40589 13.9059L9.10589 18.6059C10.2939 19.7939 10.888 20.388 11.5729 20.6105C12.1755 20.8063 12.8245 20.8063 13.4271 20.6105C14.112 20.388 14.7061 19.7939 15.8941 18.6059L18.6059 15.8941C19.7939 14.7061 20.388 14.112 20.6105 13.4271C20.8063 12.8245 20.8063 12.1755 20.6105 11.5729C20.388 10.888 19.7939 10.2939 18.6059 9.10589L13.9059 4.40589C13.387 3.88703 13.1276 3.6276 12.8249 3.44208C12.5564 3.27759 12.2638 3.15638 11.9577 3.08289C11.6124 3 11.2455 3 10.5118 3ZM7.5498 7.0498C7.5498 7.32595 7.32595 7.5498 7.0498 7.5498C6.77366 7.5498 6.5498 7.32595 6.5498 7.0498C6.5498 6.77366 6.77366 6.5498 7.0498 6.5498C7.32595 6.5498 7.5498 6.77366 7.5498 7.0498Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
                        </span>
                        <div className="cat-kpi__content">
                            <span className="cat-kpi__label">Total de Categorías</span>
                            <span className="cat-kpi__value">{totalCategorias}</span>  
                        </div> 
                    </div>

                    <div className="cat-kpi" onClick={()=> setFilterTipo('equipo')}>
                        <span className="cat-kpi__icon-box cat-kpi__icon-box--blue">
                            <svg width="30px" height="30px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" strokeL    inecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 21L12 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> <rect x="3" y="4" width="18" height="13" rx="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></rect> <path d="M9 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
                        </span>
                        <div className="cat-kpi__content">
                            <span className="cat-kpi__label">Categoria de Equipos</span>
                            <span className="cat-kpi__value">{categoriaEquipos}</span>  
                        </div> 
                    </div>

                    <div className="cat-kpi" onClick={()=> setFilterTipo('insumo')}>
                        <span className="cat-kpi__icon-box cat-kpi__icon-box--emerald">
                            <svg width="30px" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 15.1082V20.1498C12 21.2635 11.0955 22.1875 10.0128 21.9673C5.44193 21.0381 2 16.9659 2 12.0832C2 10.2294 2.49614 8.49247 3.36182 7M16.3641 21.1581C19.7003 19.5239 22 16.0743 22 12.0832C22 6.51441 17.5228 2 12 2C10.1786 2 8.47087 2.49102 7 3.34895" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path> <path d="M9 11.8C9 11.3582 9.35817 11 9.8 11H14.2C14.6418 11 15 11.3582 15 11.8V12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12V11.8Z" stroke="currentColor" strokeWidth="1.5"></path> <path d="M13.5 11V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path> <path d="M10.5 11V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path> </g></svg>
                        </span>
                        <div className="cat-kpi__content">
                            <span className="cat-kpi__label">Categoria de Insumos</span>
                            <span className="cat-kpi__value">{categoriaInsumos}</span>  
                        </div> 
                    </div>
                    
                    <div className="cat-kpi" onClick={()=> setFilterTipo('accesorio')}>
                        <span className="cat-kpi__icon-box cat-kpi__icon-box--amber">
                            <svg width="30px" height="30px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M19 15C19 18.866 15.866 22 12 22C8.13401 22 5 18.866 5 15V9C5 5.13401 8.13401 2 12 2C15.866 2 19 5.13401 19 9V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path> <path d="M10.5 8.5C10.5 7.67157 11.1716 7 12 7C12.8284 7 13.5 7.67157 13.5 8.5V10.5C13.5 11.3284 12.8284 12 12 12C11.1716 12 10.5 11.3284 10.5 10.5V8.5Z" stroke="currentColor" strokeWidth="1.5"></path> <path d="M12 2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path> </g></svg>
                        </span>
                        <div className="cat-kpi__content">
                            <span className="cat-kpi__label">Categoria de Accesorios</span>
                            <span className="cat-kpi__value">{categoriaAccesorios}</span>  
                        </div> 
                    </div>
                </div>

                {error && (
                    <div className="cat-alert cat-alert--error">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="cat-alert cat-alert--success">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span>{success}</span>
                    </div>
                )}

                
                <div className="cat-controls">
                    <div className="cat-search">
                        <span className="cat-search__icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="cat-search__input"
                            placeholder="Buscar categoría por nombre o descripción..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        className="cat-select"
                        value={filterTipo}
                        onChange={(e) => setFilterTipo(e.target.value)}
                    >
                        <option value="ALL">Todos los Tipos</option>
                        <option value="equipo">Equipos</option>
                        <option value="insumo">Insumos</option>
                        <option value="accesorio">Accesorios</option>
                    </select>
                </div>

                
                <div className="cat-table-wrapper">
                    <div className="cat-table-scroll">
                        <table className="cat-table">
                            <thead>
                                <tr>
                                    <th># ID</th>
                                    <th>Nombre</th>
                                    <th>Tipo</th>
                                    <th>Descripción</th>
                                    <th style={{ textAlign: 'center' }}>Productos</th>
                                    {isAdmin && <th style={{ textAlign: 'right' }}>Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', padding: '3rem' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', color: '#94a3b8' }}>
                                                <svg style={{ animation: 'spin 1s linear infinite' }} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                                                </svg>
                                                Cargando categorías...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredCategorias.length === 0 ? (
                                    <tr>
                                        <td colSpan={isAdmin ? 6 : 5}>
                                            <div className="cat-empty">
                                                <div className="cat-empty__icon">
                                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                                                        <path d="M7 7h.01" />
                                                    </svg>
                                                </div>
                                                <div className="cat-empty__title">No se encontraron categorías</div>
                                                <div className="cat-empty__desc">
                                                    {search || filterTipo !== 'ALL'
                                                        ? 'Intenta ajustar los criterios de búsqueda o el filtro.'
                                                        : 'Aún no hay categorías registradas en el catálogo.'}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCategorias.map((cat) => {
                                        const tipoKey = (cat.tipo || 'equipo').toLowerCase();
                                        return (
                                            <tr key={cat.id_categoria}>
                                                <td style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                                                    #{cat.id_categoria}
                                                </td>
                                                <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                                                    {cat.nombre}
                                                </td>
                                                <td>
                                                    <span onClick={()=> setFilterTipo(tipoKey)} style={{cursor:'Pointer'}} className={`cat-badge cat-badge--${tipoKey}`}>
                                                        {tipoKey}
                                                    </span>
                                                </td>
                                                <td style={{ color: cat.descripcion ? '#cbd5e1' : '#64748b' }}>
                                                    {cat.descripcion || '—'}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className="cat-count-pill" title="Productos vinculados a esta categoría">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                                        </svg>
                                                        {cat.total_productos ?? 0}
                                                    </span>
                                                </td>
                                                {isAdmin && (
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div className="cat-row-actions">
                                                            <button
                                                                type="button"
                                                                className="cat-action-btn cat-action-btn--edit"
                                                                onClick={() => handleOpenEdit(cat)}
                                                                title="Editar categoría"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="cat-action-btn cat-action-btn--delete"
                                                                onClick={() => handleOpenDelete(cat)}
                                                                title="Eliminar categoría"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <polyline points="3 6 5 6 21 6" />
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="cat-table-footer">
                        <span>
                            Mostrando <strong>{filteredCategorias.length}</strong> de <strong>{categorias.length}</strong> categorías
                        </span>
                        {filterTipo !== 'ALL' && <span>Filtro activo: {filterTipo}</span>}
                    </div>
                </div>
            </div>

            {/* Modal Crear / Editar */}
            {modalOpen && (
                <div className="cat-modal-overlay" onClick={() => !actionLoading && setModalOpen(false)}>
                    <div className="cat-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="cat-modal__header">
                            <h2 className="cat-modal__title">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                                    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                                    <path d="M7 7h.01" />
                                </svg>
                                {modalMode === 'CREATE' ? 'Nueva Categoría' : 'Editar Categoría'}
                            </h2>
                            <button
                                type="button"
                                className="cat-modal__close"
                                onClick={() => setModalOpen(false)}
                                disabled={actionLoading}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="cat-modal__body">
                                {formError && (
                                    <div className="cat-alert cat-alert--error" style={{ marginBottom: 0 }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        <span>{formError}</span>
                                    </div>
                                )}

                                <div className="cat-form-group">
                                    <label className="cat-label">
                                        Nombre de la Categoría *
                                    </label>
                                    <input
                                        type="text"
                                        className="cat-input"
                                        placeholder="Ej: Laptops, Herramientas, Papelería..."
                                        value={formNombre}
                                        onChange={(e) => setFormNombre(e.target.value)}
                                        required
                                        maxLength={80}
                                    />
                                </div>

                                <div className="cat-form-group">
                                    <label className="cat-label">
                                        Tipo de Categoría *
                                    </label>
                                    <select
                                        className="cat-select"
                                        style={{ width: '100%' }}
                                        value={formTipo}
                                        onChange={(e) => setFormTipo(e.target.value)}
                                        required
                                    >
                                        <option value="equipo">Equipo (Activos fijos / Hardware)</option>
                                        <option value="insumo">Insumo (Consumibles / Material de oficina)</option>
                                        <option value="accesorio">Accesorio (Cables, adaptadores, periféricos)</option>
                                    </select>
                                    <span className="cat-hint">
                                        Define el propósito del tipo de productos agrupados bajo esta categoría.
                                    </span>
                                </div>

                                <div className="cat-form-group">
                                    <label className="cat-label">
                                        Descripción
                                    </label>
                                    <textarea
                                        className="cat-textarea"
                                        placeholder="Detalles sobre qué bienes incluye esta categoría..."
                                        value={formDescripcion}
                                        onChange={(e) => setFormDescripcion(e.target.value)}
                                        maxLength={255}
                                    />
                                    <span className="cat-hint">
                                        {formDescripcion.length} / 255 caracteres
                                    </span>
                                </div>
                            </div>

                            <div className="cat-modal__footer">
                                <button
                                    type="button"
                                    className="cat-btn cat-btn--secondary"
                                    onClick={() => setModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="cat-btn cat-btn--primary"
                                    disabled={actionLoading || !formNombre.trim()}
                                >
                                    {actionLoading ? 'Guardando...' : modalMode === 'CREATE' ? 'Crear Categoría' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Confirmar Eliminación */}
            {deleteModalOpen && catToDelete && (
                <div className="cat-modal-overlay" onClick={() => !actionLoading && setDeleteModalOpen(false)}>
                    <div className="cat-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="cat-modal__header">
                            <h2 className="cat-modal__title" style={{ color: '#f87171' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                Eliminar Categoría
                            </h2>
                            <button
                                type="button"
                                className="cat-modal__close"
                                onClick={() => setDeleteModalOpen(false)}
                                disabled={actionLoading}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="cat-modal__body">
                            <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.9rem' }}>
                                ¿Estás seguro de que deseas eliminar la categoría <strong>{catToDelete.nombre}</strong>?
                            </p>

                            {catToDelete.total_productos > 0 ? (
                                <div className="cat-delete-box">
                                    <strong>¡Atención!</strong> Esta categoría tiene <strong>{catToDelete.total_productos}</strong> producto(s) asociado(s). No se podrá eliminar hasta que reasignes o elimines dichos productos.
                                </div>
                            ) : (
                                <span className="cat-hint" style={{ color: '#94a3b8' }}>
                                    Esta acción es permanente y no se puede deshacer.
                                </span>
                            )}
                        </div>

                        <div className="cat-modal__footer">
                            <button
                                type="button"
                                className="cat-btn cat-btn--secondary"
                                onClick={() => setDeleteModalOpen(false)}
                                disabled={actionLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="cat-btn cat-btn--danger"
                                onClick={handleDeleteConfirm}
                                disabled={actionLoading || catToDelete.total_productos > 0}
                            >
                                {actionLoading ? 'Eliminando...' : 'Eliminar Definitivamente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default Categorias;
