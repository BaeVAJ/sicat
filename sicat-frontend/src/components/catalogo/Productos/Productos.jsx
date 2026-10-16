// src/components/catalogo/Productos/Productos.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import Layout from '../../layout/Layout';
import './Productos.css';

function Productos() {
    const { usuario } = useAuth();

    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [viewMode, setViewMode] = useState('TABLE');

    // Búsqueda y Filtro por Categoría
    const [search, setSearch] = useState('');
    const [filterCategoria, setFilterCategoria] = useState('ALL');
    const [filterMM, setFilterMM] = useState('ALL');

    // Modal Crear / Editar
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
    const [currentProducto, setCurrentProducto] = useState(null);

    // Form inputs
    const [idCategoria, setIdCategoria] = useState('');
    const [nombre, setNombre] = useState('');
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');

    // Modal Eliminar
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [productoToDelete, setProductoToDelete] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [prodRes, catRes] = await Promise.all([
                client.get('/productos'),
                client.get('/categorias'),
            ]);
            setProductos(Array.isArray(prodRes.data) ? prodRes.data : []);
            setCategorias(Array.isArray(catRes.data) ? catRes.data : []);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cargar los productos');
        } finally {
            setLoading(false);
        }
    };

    // Mapa id_categoria -> objeto Categoría
    const categoriaMap = useMemo(() => {
        const map = {};
        categorias.forEach((c) => {
            map[c.id_categoria] = c;
        });
        return map;
    }, [categorias]);
    const marcasOpts = useMemo(
        () => [...new Set(productos.map((p) => p.marca?.trim()).filter(Boolean))].sort(),
        [productos]
    );
    const modelosOpts = useMemo(
        () => [...new Set(productos.map((p) => p.modelo?.trim()).filter(Boolean))].sort(),
        [productos]
    );

    // Abrir modal de creación
    const handleOpenCreate = (preselectedCatId = null) => {
        setModalMode('CREATE');
        setCurrentProducto(null);
        setNombre('');
        setMarca('');
        setModelo('');
        if (preselectedCatId) {
            setIdCategoria(String(preselectedCatId));
        } else if (filterCategoria !== 'ALL') {
            setIdCategoria(filterCategoria);
        } else {
            setIdCategoria(categorias.length > 0 ? String(categorias[0].id_categoria) : '');
        }
        setError('');
        setModalOpen(true);
    };

    // Abrir modal de edición
    const handleOpenEdit = (producto) => {
        setModalMode('EDIT');
        setCurrentProducto(producto);
        setNombre(producto.nombre || '');
        setMarca(producto.marca || '');
        setModelo(producto.modelo || '');
        setIdCategoria(String(producto.id_categoria));
        setError('');
        setModalOpen(true);
    };

    // Guardar (Crear o Actualizar)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) {
            setError('El nombre del producto es obligatorio.');
            return;
        }
        if (!idCategoria) {
            setError('Debes seleccionar una categoría.');
            return;
        }

        setActionLoading(true);
        setError('');
        setSuccess('');

        const payload = {
            id_categoria: Number(idCategoria),
            nombre: nombre.trim(),
            marca: marca.trim() || null,
            modelo: modelo.trim() || null,
        };

        try {
            if (modalMode === 'CREATE') {
                const { data } = await client.post('/productos', payload);
                setProductos((prev) => [data, ...prev]);
                setSuccess('Producto registrado exitosamente.');
            } else {
                const { data } = await client.put(`/productos/${currentProducto.id_producto}`, payload);
                setProductos((prev) =>
                    prev.map((p) => (p.id_producto === currentProducto.id_producto ? data : p))
                );
                setSuccess('Producto actualizado exitosamente.');
            }
            setModalOpen(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al guardar el producto');
        } finally {
            setActionLoading(false);
        }
    };

    // Abrir confirmación de eliminación
    const handleOpenDelete = (producto) => {
        setProductoToDelete(producto);
        setDeleteModalOpen(true);
    };

    // Confirmar eliminación
    const handleConfirmDelete = async () => {
        if (!productoToDelete) return;
        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            await client.delete(`/productos/${productoToDelete.id_producto}`);
            setProductos((prev) => prev.filter((p) => p.id_producto !== productoToDelete.id_producto));
            setSuccess('Producto eliminado exitosamente.');
        } catch (err) {
            setError(err.response?.data?.error || 'No se puede eliminar. Podría estar vinculado a compras o inventario.');
        } finally {
            setActionLoading(false);
            setDeleteModalOpen(false);
            setProductoToDelete(null);
        }
    };

    // Productos filtrados
    
    const productosFiltrados = useMemo(() => {
    const q = search.toLowerCase();
    return productos.filter((p) => {
        const catNombre = p.categoria || categoriaMap[p.id_categoria]?.nombre || '';
        const matchSearch =
            (p.nombre || '').toLowerCase().includes(q) ||
            (p.marca || '').toLowerCase().includes(q) ||
            (p.modelo || '').toLowerCase().includes(q) ||
            catNombre.toLowerCase().includes(q);
        if (!matchSearch) return false;

        if (filterCategoria !== 'ALL' && String(p.id_categoria) !== filterCategoria) return false;

        if (filterMM === 'SIN_DATOS') return !p.marca?.trim() || !p.modelo?.trim();
        if (filterMM.startsWith('M:')) return p.marca?.trim() === filterMM.slice(2);
        if (filterMM.startsWith('MO:')) return p.modelo?.trim() === filterMM.slice(3);
        return true;
    });
}, [productos, search, filterCategoria, filterMM, categoriaMap]);

    // Métricas y estadísticas
    const totalProductos = new Set(productosFiltrados.map((p)=>p.id_producto)).size;
    const categoriasConProductosCount = new Set(productosFiltrados.map((p) => p.id_categoria)).size;
    const marcasUnicas = new Set(productosFiltrados.map((p) => p.marca).filter(Boolean)).size;
    const modelosUnicos = new Set(productosFiltrados.map((p) => p.modelo).filter(Boolean)).size;
    
    const productosSinMarca = productosFiltrados.filter((p) => (!p.marca || p.marca.trim() === '' || !p.modelo || p.modelo.trim() === '')).length;

    // Agrupación de productos por categoría
    const groupedData = useMemo(() => {
    const list = filterCategoria === 'ALL'
        ? categorias
        : categorias.filter((c) => String(c.id_categoria) === filterCategoria);

    return list.map((cat) => ({
        categoria: cat,
        productos: productosFiltrados.filter((p) => p.id_categoria === cat.id_categoria),
    }));
}, [categorias, productosFiltrados, filterCategoria]);

    return (
        <Layout>
            <div className="productos-container">
                <div className="productos-header">
                    <div>
                        <h1 className="productos-header__title">
                            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15.5777 3.38197L17.5777 4.43152C19.7294 5.56066 20.8052 6.12523 21.4026 7.13974C22 8.15425 22 9.41667 22 11.9415V12.0585C22 14.5833 22 15.8458 21.4026 16.8603C20.8052 17.8748 19.7294 18.4393 17.5777 19.5685L15.5777 20.618C13.8221 21.5393 12.9443 22 12 22C11.0557 22 10.1779 21.5393 8.42229 20.618L6.42229 19.5685C4.27063 18.4393 3.19479 17.8748 2.5974 16.8603C2 15.8458 2 14.5833 2 12.0585V11.9415C2 9.41667 2 8.15425 2.5974 7.13974C3.19479 6.12523 4.27063 5.56066 6.42229 4.43152L8.42229 3.38197C10.1779 2.46066 11.0557 2 12 2C12.9443 2 13.8221 2.46066 15.5777 3.38197Z" />
                                <path opacity="0.6" d="M21 7.5L17 9.5M12 12L3 7.5M12 12V21.5M12 12C12 12 14.7426 10.6287 16.5 9.75C16.6953 9.65237 17 9.5 17 9.5M17 9.5V13M17 9.5L7.5 4.5" />
                            </svg>
                            Catálogo de Productos
                        </h1>
                        <p className="productos-header__subtitle">
                            Administra, clasifica y gestiona los productos, marcas y modelos del catálogo general
                        </p>
                    </div>

                    <div className="productos-header__actions">
                        <button
                            type="button"
                            className="productos-btn productos-btn--secondary"
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
                                className={loading ? 'productos-btn__spin' : ''}
                            >
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            <span>Actualizar</span>
                        </button>

                        {['admin', 'gerente'].includes(usuario?.rol) && (
                            <button
                                type="button"
                                className="productos-btn productos-btn--primary"
                                onClick={() => handleOpenCreate()}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Nuevo Producto</span>
                            </button>
                        )}
                    </div>
                </div>
                {error && (
                    <div className="productos-alert productos-alert--error" role="alert">
                        <div className="productos-alert__content">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                            <span>{error}</span>
                        </div>
                        <button type="button" className="productos-alert__close" onClick={() => setError('')} aria-label="Cerrar alerta">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {success && (
                    <div className="productos-alert productos-alert--success" role="alert">
                        <div className="productos-alert__content">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <span>{success}</span>
                        </div>
                        <button type="button" className="productos-alert__close" onClick={() => setSuccess('')} aria-label="Cerrar notificación">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                <div className="productos-kpis">
                    <div className="productos-kpi" onClick={()=> (setFilterMM("ALL"), setFilterCategoria("ALL"))}>
                        <div className="productos-kpi__icon-box productos-kpi__icon-box--cyan">
                            <svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" strokeL    inecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 21L12 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> <rect x="3" y="4" width="18" height="13" rx="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></rect> <path d="M9 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
                        </div>
                        <div className="productos-kpi__content">
                            <div className="productos-kpi__label">Total de Productos</div>
                            <div className="productos-kpi__value">{totalProductos}</div>
                        </div>
                    </div>
                    
                    <div className="productos-kpi" onClick={()=> (setFilterCategoria("ALL"))}>
                        <div className="productos-kpi__icon-box productos-kpi__icon-box--blue">
                            <svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M7.0498 7.0498H7.0598M10.5118 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V10.5118C3 11.2455 3 11.6124 3.08289 11.9577C3.15638 12.2638 3.27759 12.5564 3.44208 12.8249C3.6276 13.1276 3.88703 13.387 4.40589 13.9059L9.10589 18.6059C10.2939 19.7939 10.888 20.388 11.5729 20.6105C12.1755 20.8063 12.8245 20.8063 13.4271 20.6105C14.112 20.388 14.7061 19.7939 15.8941 18.6059L18.6059 15.8941C19.7939 14.7061 20.388 14.112 20.6105 13.4271C20.8063 12.8245 20.8063 12.1755 20.6105 11.5729C20.388 10.888 19.7939 10.2939 18.6059 9.10589L13.9059 4.40589C13.387 3.88703 13.1276 3.6276 12.8249 3.44208C12.5564 3.27759 12.2638 3.15638 11.9577 3.08289C11.6124 3 11.2455 3 10.5118 3ZM7.5498 7.0498C7.5498 7.32595 7.32595 7.5498 7.0498 7.5498C6.77366 7.5498 6.5498 7.32595 6.5498 7.0498C6.5498 6.77366 6.77366 6.5498 7.0498 6.5498C7.32595 6.5498 7.5498 6.77366 7.5498 7.0498Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
                        </div>
                        <div className="productivos-kpi__content">
                            <div className="productos-kpi__label">Categorias</div>
                            <div className="productos-kpi__value">{categoriasConProductosCount}</div> 
                        </div>
                        
                    </div>
                    <div className="productos-kpi" onClick={()=> setFilterMM("SIN_DATOS")}>
                        <div className="productos-kpi__icon-box productos-kpi__icon-box--amber">
                            <svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M10.2801 20.25H17.0001C19.7601 20.25 22.0001 18.01 22.0001 15.25V8.75C22.0001 5.99 19.7601 3.75 17.0001 3.75H10.2801C8.87005 3.75 7.53005 4.34 6.58005 5.39L3.05005 9.27C1.64005 10.82 1.64005 13.18 3.05005 14.73L6.58005 18.61C7.53005 19.66 8.87005 20.25 10.2801 20.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path> <path d="M16.0001 14.47L11.0601 9.53003" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path> <path d="M11.0601 14.47L16.0001 9.53003" stroke="CurrentColor" strokeWidth="1.5" strokeLinecap="round"></path> </g></svg>
                        </div>
                        <div className="productos-kpi__content">
                            <span className="productos-kpi__label">Productos Sin Marcas / modelo</span>
                            <span className="productos-kpi__count">{productosSinMarca}</span>
                        </div>
                    </div>
                </div>
                <div className="productos-toolbar">
                    <div className="productos-search-wrap">
                        <span className="productos-search-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="productos-search-input"
                            placeholder="Buscar producto, marca, modelo o categoría..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                            className="productos-filter-select"
                            value={filterCategoria}
                            onChange={(e) => setFilterCategoria(e.target.value)}
                        >
                            <option value="ALL">Todas las Categorías</option>
                            {categorias.map((cat) => (
                                <option key={cat.id_categoria} value={String(cat.id_categoria)}>
                                    {cat.nombre} {cat.tipo ? `(${cat.tipo})` : ''}
                                </option>
                            ))}
                        </select>

                        <select
                            className="productos-filter-select"
                            value={filterMM}
                            onChange={(e) => setFilterMM(e.target.value)}
                        >
                            <option value="ALL">Todas las marcas / modelos</option>
                            <option value="SIN_DATOS">Sin marca o modelo</option>
                            <optgroup label="Marca">
                                {marcasOpts.map((m) => <option key={`m-${m}`} value={`M:${m}`}>{m}</option>)}
                            </optgroup>
                            <optgroup label="Modelo">
                                {modelosOpts.map((m) => <option key={`mo-${m}`} value={`MO:${m}`}>{m}</option>)}
                            </optgroup>
                        </select>

                        {/* Switch de Vistas */}
                        <div className="productos-view-switch">
                            <button
                                type="button"
                                className={`productos-view-switch__btn ${viewMode === 'GROUPED' ? 'productos-view-switch__btn--active' : ''}`}
                                onClick={() => setViewMode('GROUPED')}
                                title="Vista Agrupada por Categoría"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                    <polyline points="2 17 12 22 22 17" />
                                    <polyline points="2 12 12 17 22 12" />
                                </svg>
                                <span>Por Categoría</span>
                            </button>

                            <button
                                type="button"
                                className={`productos-view-switch__btn ${viewMode === 'GRID' ? 'productos-view-switch__btn--active' : ''}`}
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
                                className={`productos-view-switch__btn ${viewMode === 'TABLE' ? 'productos-view-switch__btn--active' : ''}`}
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
                                <span>Tabla</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Category Quick Filter Pills ── */}
                
                
                {loading ? (
                    <div className="productos-empty">
                        <div className="productos-empty__icon">
                            <span className="productos-btn__spin">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="23 4 23 10 17 10" />
                                    <polyline points="1 20 1 14 7 14" />
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                </svg>
                            </span>
                        </div>
                        <h3 className="productos-empty__title">Cargando catálogo de productos...</h3>
                    </div>
                ) : productosFiltrados.length === 0 ? (
                    <div className="productos-empty">
                        <div className="productos-empty__icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </div>
                        <h3 className="productos-empty__title">No se encontraron productos</h3>
                        <p className="productos-empty__desc">
                            {search || filterCategoria !== 'ALL'
                                ? 'No hay productos que coincidan con la búsqueda o filtro aplicado.'
                                : 'Aún no hay productos registrados en el catálogo.'}
                        </p>
                        {['admin', 'gerente'].includes(usuario?.rol) && (
                            <button
                                type="button"
                                className="productos-btn productos-btn--primary"
                                onClick={() => handleOpenCreate()}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Crear Primer Producto</span>
                            </button>
                        )}
                    </div>
                ) : viewMode === 'GROUPED' ? (
                    /* ── VISTA 1: AGRUPADO POR CATEGORÍA ── */
                    <div className="productos-grouped-list">
                        {groupedData.map(({ categoria: cat, productos: prods }) => (
                            <div key={cat.id_categoria} className="productos-group-card">
                                <div className="productos-group-card__header">
                                    <div className="productos-group-card__title-wrap">
                                        <div className="productos-group-card__icon">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                                                <path d="M7 7h.01" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="productos-group-card__name">{cat.nombre}</h3>
                                            {cat.descripcion && (
                                                <div className="productos-group-card__desc">{cat.descripcion}</div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <span className="productos-badge productos-badge--cat">
                                            {prods.length} {prods.length === 1 ? 'producto' : 'productos'}
                                        </span>

                                        {['admin', 'gerente'].includes(usuario?.rol) && (
                                            <button
                                                type="button"
                                                className="productos-btn productos-btn--secondary"
                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                                onClick={() => handleOpenCreate(cat.id_categoria)}
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

                                {prods.length === 0 ? (
                                    <div style={{ color: 'rgba(148, 163, 184, 0.5)', fontSize: '0.84rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                        No hay productos registrados en esta categoría
                                    </div>
                                ) : (
                                    <div className="productos-group-card__grid">
                                        {prods.map((prod) => (
                                            <div key={prod.id_producto} className="productos-mini-card">
                                                <div >
                                                    <h4 className="productos-mini-card__title">{prod.nombre}</h4>
                                                    <div className="productos-mini-card__tags">
                                                        {prod.marca && (
                                                            <span className="productos-badge productos-badge--marca" onClick={() => setFilterMM(prod.marca ? `M:${prod.marca}` : 'SIN_DATOS')} style={{ cursor: 'pointer' }}>
                                                                {prod.marca}
                                                            </span>
                                                        )}
                                                        {prod.modelo && (
                                                            <span className="productos-badge productos-badge--modelo" onClick={() => setFilterMM(prod.modelo ? `MO:${prod.modelo}` : 'SIN_DATOS')} style={{ cursor: 'pointer' }}>
                                                                {prod.modelo}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {['admin', 'gerente'].includes(usuario?.rol) && (
                                                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                        <button
                                                            type="button"
                                                            className="productos-action-btn productos-action-btn--edit"
                                                            onClick={() => handleOpenEdit(prod)}
                                                            disabled={actionLoading}
                                                            title="Editar producto"
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="productos-action-btn productos-action-btn--delete"
                                                            onClick={() => handleOpenDelete(prod)}
                                                            disabled={actionLoading}
                                                            title="Eliminar producto"
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
                    /* ── VISTA 2: TARJETAS / MOSAICO ── */
                    <div className="productos-grid">
                        {productosFiltrados.map((prod) => {
                            const cat = categoriaMap[prod.id_categoria];
                            
                            return (
                                <div key={prod.id_producto} className="productos-card">
                                    <div className="productos-card__header">
                                        <h3 className="productos-card__name">{prod.nombre}</h3>
                                        <span className="productos-card__id">#{prod.id_producto}</span>
                                    </div>

                                    <div className="productos-card__body">
                                        <div className="productos-card__category">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                                                <path d="M7 7h.01" />
                                            </svg>
                                            <span onClick={()=> setFilterCategoria(String(prod.id_categoria))} style={{cursor: 'pointer'}}>{prod.categoria || cat?.nombre || `Categoría #${prod.id_categoria}`}</span>
                                        </div>

                                        <div className="productos-card__details">
                                            {prod.marca && (
                                                <span className="productos-badge productos-badge--marca" onClick={() => setFilterMM(prod.marca ? `M:${prod.marca}` : 'SIN_DATOS')} style={{cursor:'pointer'}}>
                                                    Marca: {prod.marca}
                                                </span>
                                            )}
                                            {prod.modelo && (
                                                <span className="productos-badge productos-badge--modelo" onClick={() => setFilterMM(prod.modelo ? `MO:${prod.modelo}` : `SIN_DATOS`)} style={{cursor: 'pointer'}}>
                                                    Mod: {prod.modelo}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {['admin', 'gerente'].includes(usuario?.rol) && (
                                        <div className="productos-card__footer">
                                            <button
                                                type="button"
                                                className="productos-action-btn productos-action-btn--edit"
                                                onClick={() => handleOpenEdit(prod)}
                                                disabled={actionLoading}
                                                title="Editar producto"
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                                <span>Editar</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="productos-action-btn productos-action-btn--delete"
                                                onClick={() => handleOpenDelete(prod)}
                                                disabled={actionLoading}
                                                title="Eliminar producto"
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    <div className="productos-table-wrap">
                        <table className="productos-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nombre del Producto</th>
                                    <th>Categoría</th>
                                    <th>Marca</th>
                                    <th>Modelo</th>
                                    {['admin', 'gerente'].includes(usuario?.rol) && <th>Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {productosFiltrados.map((prod) => (
                                    <tr key={prod.id_producto}>
                                        <td className="productos-table__id">#{prod.id_producto}</td>
                                        <td className="productos-table__name">{prod.nombre}</td>
                                        <td>
                                            <span style={{cursor:'pointer'}} className="productos-badge productos-badge--cat" onClick={() => setFilterCategoria(String(prod.id_categoria))}>
                                                {prod.categoria || categoriaMap[prod.id_categoria]?.nombre || `Cat #${prod.id_categoria}`}
                                            </span>
                                        </td>
                                        <td>
                                            {prod.marca ? (
                                                <span className="productos-badge productos-badge--marca" onClick={()=> setFilterMM(prod.marca ? `M:${prod.marca}` : "SIN_DATOS")} style={{cursor: 'pointer'}}>{prod.marca}</span>
                                            ) : (
                                                <span style={{ color: 'rgba(148, 163, 184, 0.4)' }}>—</span>
                                            )}
                                        </td>
                                        <td>
                                            {prod.modelo ? (
                                                <span className="productos-badge productos-badge--modelo" onClick={() => setFilterMM(prod.modelo ? `MO:${prod.modelo}` : 'SIN_DATOS')} style={{cursor:'pointer'}}>{prod.modelo}</span>
                                            ) : (
                                                <span style={{ color: 'rgba(148, 163, 184, 0.4)' }}>—</span>
                                            )}
                                        </td>
                                        {['admin', 'gerente'].includes(usuario?.rol) && (
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <button
                                                        type="button"
                                                        className="productos-action-btn productos-action-btn--edit"
                                                        onClick={() => handleOpenEdit(prod)}
                                                        disabled={actionLoading}
                                                        title="Editar producto"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="productos-action-btn productos-action-btn--delete"
                                                        onClick={() => handleOpenDelete(prod)}
                                                        disabled={actionLoading}
                                                        title="Eliminar producto"
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
                        <div className="productos-table__footer">
                                <span className="productos-table__footer-text">Mostrando <strong>{productosFiltrados.length}</strong> de <strong>{productos.length}</strong> productos</span>
                            </div>
                    </div>
                )}
                {modalOpen && (
                    <div className="productos-modal-overlay">
                        <div className="productos-modal">
                            <div className="productos-modal__header">
                                <h2 className="productos-modal__title">
                                    {modalMode === 'CREATE' ? 'Nuevo Producto' : 'Editar Producto'}
                                </h2>
                                <button
                                    type="button"
                                    className="productos-modal__close"
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
                                <div className="productos-form-group">
                                    <label className="productos-form-label">Categoría *</label>
                                    <select
                                        className="productos-form-select"
                                        value={idCategoria}
                                        onChange={(e) => setIdCategoria(e.target.value)}
                                        required
                                    >
                                        <option value="">Selecciona una categoría</option>
                                        {categorias.map((cat) => (
                                            <option key={cat.id_categoria} value={cat.id_categoria}>
                                                {cat.nombre} {cat.tipo ? `(${cat.tipo})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
 
                                <div className="productos-form-group">
                                    <label className="productos-form-label">Nombre del Producto *</label>
                                    <input
                                        type="text"
                                        className="productos-form-input"
                                        placeholder="Ej. Laptop Latitude 5420, Switch Gigabit 24 Puertos..."
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="productos-grid-2">
                                    <div className="productos-form-group">
                                        <label className="productos-form-label">Marca (Opcional)</label>
                                        <input
                                            type="text"
                                            className="productos-form-input"
                                            placeholder="Ej. Dell, HP, Cisco..."
                                            value={marca}
                                            onChange={(e) => setMarca(e.target.value)}
                                        />
                                    </div>
                                    <div className="productos-form-group">
                                        <label className="productos-form-label">Modelo (Opcional)</label>
                                        <input
                                            type="text"
                                            className="productos-form-input"
                                            placeholder="Ej. SG350-28P, ProBook 450..."
                                            value={modelo}
                                            onChange={(e) => setModelo(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="productos-modal__footer">
                                    <button
                                        type="button"
                                        className="productos-btn productos-btn--secondary"
                                        onClick={() => setModalOpen(false)}
                                        disabled={actionLoading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="productos-btn productos-btn--primary"
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? (
                                            <>
                                                <span className="productos-btn__spin">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="23 4 23 10 17 10" />
                                                        <polyline points="1 20 1 14 7 14" />
                                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                                    </svg>
                                                </span>
                                                <span>Guardando...</span>
                                            </>
                                        ) : (
                                            <span>{modalMode === 'CREATE' ? 'Crear Producto' : 'Guardar Cambios'}</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {deleteModalOpen && (
                    <div className="productos-modal-overlay">
                        <div className="productos-modal">
                            <div className="productos-modal__header">
                                <h2 style={{color: '#fca5a5'}} className="productos-modal__title">Eliminar Producto</h2>
                                <button
                                    type="button"
                                    className="productos-modal__close"
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
                            <div className="productos-modal-delete__content">
                                <p className="productos-modal-delete__text">
                                    ¿Estás seguro de eliminar el producto "<strong>{productoToDelete?.nombre}</strong> · <strong>{productoToDelete?.marca}</strong> · <strong>{productoToDelete?.modelo}</strong>"?
                                </p>

                                <div className="productos-modal-delete__warning">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fillRule="evenodd" clipRule="evenodd" d="M19.5 12C19.5 16.1421 16.1421 19.5 12 19.5C7.85786 19.5 4.5 16.1421 4.5 12C4.5 7.85786 7.85786 4.5 12 4.5C16.1421 4.5 19.5 7.85786 19.5 12ZM21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12ZM11.25 13.5V8.25H12.75V13.5H11.25ZM11.25 15.75V14.25H12.75V15.75H11.25Z" fill="currentColor"></path> </g></svg>
                                    Si el producto está asociado a algún registro de inventario o compra, no se podrá eliminar.
                                </div>
                            </div>
                            <div className="productos-modal-delete__footer">
                                <button
                                    type="button"
                                    className="productos-btn productos-btn--secondary"
                                    onClick={() => setDeleteModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="productos-btn productos-btn--danger"
                                    onClick={() => handleConfirmDelete(productoToDelete)}
                                    disabled={actionLoading}
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

export default Productos;