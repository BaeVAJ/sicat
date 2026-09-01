import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client'
import Layout from "../../layout/Layout";
import './productos.css'

function Productos() {

    const { usuario } = useAuth();
    const [categorias, setCategorias] = useState([]);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [viewMode, setViewMode] = useState('GROUPED')

    const [search, setSearch] = useState('');
    const [filterCategoria, setFilterCategoria] = useState('ALL')

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('CREATE')

    const [currentProducto, setCurrentProducto] = useState(null)

    const [idCategoria, setIdCategoria] = useState('');
    const [nombre, setNombre] = useState('');
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [productoToDelete, setProductoToDelete] = useState(null)

    useEffect(() => {
        fetchData();

    }, []);
    const categoriaMap = useMemo(() => {
        const map = {};
        categorias.forEach((c) => {
            map[c.id_categoria] = c;
        });
        return map;
    }, [categorias]);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [prodRes, catRes] = await Promise.all([client.get('/productos'), client.get('/categorias')]);
            setProductos(Array.isArray(prodRes.data) ? prodRes.data : []);
            setCategorias(Array.isArray(catRes.data) ? catRes.data : []);
        } catch (error) {
            setError(error.response?.data?.error || 'Error al cargar los productos');
        } finally {
            setLoading(false);
        }
    }

    const handleOpenModal = (preselectedCatId = null) => {
        setModalMode(preselectedCatId ? 'CREATE' : 'CREATE');
        setCurrentProducto(null);
        setIdCategoria(preselectedCatId || '');
        setNombre('');
        setMarca('');
        setModelo('');

        if (preselectedCatId) {
            setIdCategoria(String(preselectedCatId));
        } else if (filterCategoria !== 'ALL') {
            setIdCategoria(filterCategoria);
        } else {
            setIdCategoria(categorias.length > 0 ? String(categorias[0].id) : '');
        }
        setError('');
        setModalOpen(true);
    };
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
        setIdCategoria(String(producto.id_categoria) || '');
        setNombre(producto.nombre);
        setMarca(producto.marca || '');
        setModelo(producto.modelo || '');
        setError('')
        setModalOpen(true);
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) {
            setError('El nombre es requerido');
            return;
        }
        if (!idCategoria) {
            setError('Debe seleccionar una categoria');
            return;
        }
        setActionLoading(true)
        setError('')
        setSuccess('')

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
        setPreductoToDelete(producto)
        setDeleteModalOpen(true);
    };
    const handleConfirmDelete = async () => {
        if (!productoToDelete) { return; }
        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            await client.delete(`/productos/${productoToDelete.id_producto}`);
            setProductos((prev) => prev.filter((p) => p.id_producto !== productoToDelete.id_producto));
            setSuccess("Producto Eliminado Correctamente")
            setDeleteModalOpen(false);
            setProductoToDelete(null);
        } catch (error) {
            setError(error.response?.data?.error || 'Error al eliminar el producto');
        } finally {
            setActionLoading(false)
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

    const totalProductos = productosFiltrados.length;
    const categoriasconProductos = new Set(productos.map((p) => p.id_categoria)).size;
    const marcasUnicas = new Set(productos.map((p) => p.marca).filter(Boolean)).size;

    const groupedDAta = useMemo(() => {
        const list = filterCategoria === 'ALL' ? categorias : categorias.filter((c) => String(c.id_categoria) === filterCategoria);

        return list.map((cat) => {
            const prods = productosFiltrados.filter((p) => p.id_categoria === cat.id_categoria);
            return {
                categoria: 'cat',
                productos: 'prods',
            };
        }, [categorias, productosFiltrados, filterCategoria]);
    });

    return (
        <Layout>
            <div className='productos-container'>
                <div className='productos-header'>
                    <div className=''>
                        <h1 className="productos-header__title">
                            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15.5777 3.38197L17.5777 4.43152C19.7294 5.56066 20.8052 6.12523 21.4026 7.13974C22 8.15425 22 9.41667 22 11.9415V12.0585C22 14.5833 22 15.8458 21.4026 16.8603C20.8052 17.8748 19.7294 18.4393 17.5777 19.5685L15.5777 20.618C13.8221 21.5393 12.9443 22 12 22C11.0557 22 10.1779 21.5393 8.42229 20.618L6.42229 19.5685C4.27063 18.4393 3.19479 17.8748 2.5974 16.8603C2 15.8458 2 14.5833 2 12.0585V11.9415C2 9.41667 2 8.15425 2.5974 7.13974C3.19479 6.12523 4.27063 5.56066 6.42229 4.43152L8.42229 3.38197C10.1779 2.46066 11.0557 2 12 2C12.9443 2 13.8221 2.46066 15.5777 3.38197Z" />
                                <path opacity="0.6" d="M21 7.5L17 9.5M12 12L3 7.5M12 12V21.5M12 12C12 12 14.7426 10.6287 16.5 9.75C16.6953 9.65237 17 9.5 17 9.5M17 9.5V13M17 9.5L7.5 4.5" />
                            </svg>
                            Catálogo de Productos
                        </h1>
                        <p className='productos-header__subtitle'>
                            Administra los productos
                        </p>
                    </div>
                    <div className="productos-header__actions">
                        <button
                            type="button"
                            className="productos-btn productos-btn--secondary"
                            onClick={fetchData}
                            disabled={loading}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M3 2v6h6"></path> <path d="M21 12A9 9 0 006 5.3L3 8"></path> <path d="M21 22v-6h-6"></path> <path d="M3 12a9 9 0 0015 6.7l3-2.7"></path> </g></svg>
                            <span>Actualizar</span>

                        </button>
                        {['admin', 'gerente'].includes(usuario?.rol) && (
                            <button
                                type='button'
                                className='productos-btn productos-btn--primary'
                                onClick={() => handleOpenCreate()}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Agregar producto</span>
                            </button>
                        )}
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
                    </div>
                </div>

            </div>
        </Layout>

    )
};
export default Productos;;