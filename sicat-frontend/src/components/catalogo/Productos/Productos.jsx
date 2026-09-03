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

    const [viewMode, setViewMode] = useState('GROUPED');

    const [search, setSearch] = useState('');
    const [filterCategoria, setFilterCategoria] = useState('ALL');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('CREATE');
    const [currentProducto, setCurrentProducto] = useState(null);

    const [idCategoria, setIdCategoria] = useState('');
    const [nombre, setNombre] = useState('');
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');

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

    const categoriaMap = useMemo(() => {
        const map = {};
        categorias.forEach((c) => {
            map[c.id_categoria] = c;
        });
        return map;
    }, [categorias]);

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

    const handleOpenDelete = (producto) => {
        setProductoToDelete(producto);
        setDeleteModalOpen(true);
    };


    const handleConfirmDelete = async () => {
        if (!productoToDelete) return;
        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            await client.delete(`/productos/${productoToDelete.id_producto}`);
            setProductos((prev) => prev.filter((p) => p.id_producto !== productoToDelete.id_producto));
            setSuccess('Producto eliminado exitosamente.');
            setDeleteModalOpen(false);
            setProductoToDelete(null);
        } catch (err) {
            setError(err.response?.data?.error || 'No se puede eliminar. Podría estar vinculado a compras o inventario.');
        } finally {
            setActionLoading(false);
        }
    };

    const productosFiltrados = useMemo(() => {
        return productos.filter((p) => {
            const catNombre = p.categoria || categoriaMap[p.id_categoria]?.nombre || '';
            const matchSearch =
                (p.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.marca || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.modelo || '').toLowerCase().includes(search.toLowerCase()) ||
                catNombre.toLowerCase().includes(search.toLowerCase());

            if (!matchSearch) return false;
            if (filterCategoria !== 'ALL') return String(p.id_categoria) === filterCategoria;
            return true;
        });
    }, [productos, search, filterCategoria, categoriaMap]);

    const totalProductos = productos.length;
    const categoriasConProductosCount = new Set(productos.map((p) => p.id_categoria)).size;
    const marcasUnicas = new Set(productos.map((p) => p.marca).filter(Boolean)).size;

    const groupedData = useMemo(() => {
        const list = filterCategoria === 'ALL'
            ? categorias
            : categorias.filter((c) => String(c.id_categoria) === filterCategoria);

        return list.map((cat) => {
            const prods = productosFiltrados.filter((p) => p.id_categoria === cat.id_categoria);
            return {
                categoria: cat,
                productos: prods,
            };
        });
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
                <div className="productos-pills">
                    <button
                        type="button"
                        className={`productos-pill ${filterCategoria === 'ALL' ? 'productos-pill--active' : ''}`}
                        onClick={() => setFilterCategoria('ALL')}
                    >
                        <span>Todas</span>
                        <span className="productos-pill__count">{productos.length}</span>
                    </button>
                    {categorias.map((cat) => {
                        const count = productos.filter((p) => p.id_categoria === cat.id_categoria).length;
                        return (
                            <button
                                key={cat.id_categoria}
                                type="button"
                                className={`productos-pill ${filterCategoria === String(cat.id_categoria) ? 'productos-pill--active' : ''}`}
                                onClick={() => setFilterCategoria(String(cat.id_categoria))}
                            >
                                <span>{cat.nombre}</span>
                                <span className="productos-pill__count">{count}</span>
                            </button>
                        );
                    })}
                </div>
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
                                                <div>
                                                    <h4 className="productos-mini-card__title">{prod.nombre}</h4>
                                                    <div className="productos-mini-card__tags">
                                                        {prod.marca && (
                                                            <span className="productos-badge productos-badge--marca">
                                                                {prod.marca}
                                                            </span>
                                                        )}
                                                        {prod.modelo && (
                                                            <span className="productos-badge productos-badge--modelo">
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
                    <div className='productos-grid'>
                        {productosFiltrados.map((prod) => {
                            const cat = categoriaMap[prod.id_categoria];
                            return (
                                <div key={prod.id_producto} className="productos-card">
                                    <div className="productos-card__header">
                                        <h3 className='productos-card__name'>{prod.nombre}</h3>
                                        <span className='productos-card__id'>#{prod.id_producto}</span>
                                    </div>
                                    <div className='productos-card__body'>
                                        <div className='productos-card__category'>
                                            <svg width='13' height='13' viewBox=' 0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.25'>
                                                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                                                <path d="M7 7h.01" />
                                            </svg>
                                            <span>{prod.categoria || cat?.nombre || `Categoria #${prod.id_categoria}`}</span>
                                        </div>
                                        <div className="productos-card__details">
                                            {prod.marca && (
                                                <span className="productos-badge productos-badge--marca">
                                                    Marca: {prod.marca}
                                                </span>
                                            )}
                                            {prod.modelo && (
                                                <span className="productos-badge productos-badge--marca">
                                                    Modelo: {prod.modelo}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {['admin', 'gerente'].includes(usuario?.rol) && (
                                        <div className="productos-card__footer">
                                            <button
                                                className="productos-action-btn productos-action-btn--edit"
                                                onClick={() => handleOpenEdit(prod)}
                                                disabled={actionLoading}
                                                title="editar producto">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                                <span>Editar</span>
                                            </button>
                                            <button
                                                className='productos-action-btn productos-action-btn--delete'
                                                onClick={() => handleOpenDelete(prod)}
                                                disabled={actionLoading}
                                                title="Eliminar Producto">
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
                    <div className="productos-table-wrap">
                        <table className="productos-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nombre del producto</th>
                                    <th>Categoria</th>
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
                                            <span className="productos-badge productos-badge--cat">
                                                {prod.categoria || categoriaMap[prod.id_categoria]?.nombre || `Cat #${prod.id_categoria}`}
                                            </span>
                                        </td>
                                        <td>
                                            {prod.marca ? (
                                                <span className="productos-badge productos-badge--marca">{prod.marca}</span>
                                            ) : (
                                                <span style={{ color: 'rgba(148, 163, 184, 0.4)' }}>—</span>
                                            )}
                                        </td>
                                        <td>
                                            {prod.modelo ? (
                                                <span className="productos-badge productos-badge--modelo">{prod.modelo}</span>
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
                    </div>
                )}
                {modalOpen && (
                    <div className='productos-modal-overlay'>
                        <div className='productos-modal'>
                            <div className='productos-modal__header'>
                                <h2 className="productos-modal__title">
                                    {modalMode === 'CREATE' ? 'Agregar Producto' : 'Editar Producto'}
                                </h2>
                                <button
                                    type="button"
                                    className='productos-modal__close'
                                    onClick={() => setModalOpen(false)}
                                    aria-label='cerrar modal'>
                                    <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                        <line x1='18' y1='6' x2='6' y2='18' />
                                        <line x1='6' y1='6' x2='18' y2='18' />
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

                                <div className='productos-form-group'>
                                    <label className="productos-form-label">Nombre del producto</label>
                                    <input
                                        type="text"
                                        className="productos-form-input"
                                        placeholder="Ej. Laptop Dell XPS 15, Switch Gigabit 24 puertos ..."
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        required
                                        autoFocus>
                                    </input>
                                </div>
                                <div className='productos-form-grid-2'>
                                    <div className='productos-form-group'>
                                        <input
                                            type="text"
                                            className="productos-form-input"
                                            placeholder='Ej. DELL, HP, Cisco'
                                            value={marca}
                                            onChange={(e) => setMarca(e.target.value)} />
                                    </div>

                                </div>
                            </form>

                        </div>
                    </div>
                )}
            </div>
        </Layout >

    )
};
export default Productos;