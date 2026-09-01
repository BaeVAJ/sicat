import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import client from '../../../api/client'
import Layout from "../../layout/layout.jsx"
import './productos.css'

function Productos() {

    const [usuario] = useAuth();
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
                setProductos(prev => [...prev, data])
                setSuccess('Producto Registrado Exitosamente')
            } else {
                const { data } = await client.put(`/productos/${currentProducto.id_producto}`, payload);
                setProductos((prev) => prev.map((p) => p.id === currentProducto.id_producto ? data : p))

            }
        } catch {

        }
    }
    return (
        <Layout>
            <h1>Productos</h1>
        </Layout>
    )
}
export default Productos