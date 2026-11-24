/*nota 
si se cambio el departamento de un usuario ya logueado a Sistemas 
y el inventario no se actualiza, salir y volver a entrar a la cuenta
*/

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import Layout from '../../layout/Layout';
import './Inventario.css';

const DEPARTAMENTO_SISTEMAS = 1;

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

function Inventario() {
    const { usuario } = useAuth();
    const isAdmin = usuario?.rol === 'admin';
    const [searchParams] = useSearchParams();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [saving, setSaving] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);

    const [productos, setProductos] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [addOpen, setAddOpen] = useState(false);
    const [addSaving, setAddSaving] = useState(false);

    const [newProduct, setNewProduct] = useState({
        id_producto: '',
        id_departamento: usuario?.id_departamento,  
        cantidad_disponible: 0,
        cantidad_minima: 1,
    });

    const [search, setSearch] = useState('');
    const [filterEstado, setFilterEstado] = useState('ALL');
    const [filterDepartamento, setFilterDepartamento] = useState('ALL');
    const [filterEmpresa, setFilterEmpresa] = useState('ALL');
    const [orden, setOrden] = useState('CRITICO');

    const isSystems = Number(usuario?.id_departamento) === Number(DEPARTAMENTO_SISTEMAS);
    const canEdit = isSystems || usuario?.rol === 'gerente' || usuario?.rol === 'admin';

    const [filters, setFilters] = useState({
        material: '',
        departamento: '',
        marca: '',
        disponible: '',
        estado: '',
    });
    const [sort, setSort] = useState({ key: 'departamento', dir: 'desc' });

    const [message, setMessage] = useState({type: '', text: ''});

    //eliminar productos del inventario
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deletingItem, setDeletingItem] = useState(false);

    const showMessage = useCallback((type, text) => {
        setMessage({ type, text});
    }, []);

    useEffect(() => {
        queueMicrotask(loadInventory);
    }, []);

    useEffect(() => {
        if (message.type==='success') {
            setTimeout(() => {
                showMessage('','');
            }, 5000);
        }
        return;
    }), [error, success];

    async function loadInventory() {
        setLoading(true);
        showMessage('','');
        try {
            const [invRes, depRes, empRes, prodRes] = await Promise.all([
                client.get('/inventario/departamento'),
                client.get('/departamentos'),
                client.get('/empresas'),
                client.get('/productos'),
            
            ]);
            setItems(Array.isArray(invRes.data) ? invRes.data : []);
            setDepartamentos(Array.isArray(depRes.data) ? depRes.data : []);
            setEmpresas(Array.isArray(empRes.data) ? empRes.data : []);
            setProductos(Array.isArray(prodRes.data) ? prodRes.data : []);
        } catch (err) {
            let message = 'No se pudo cargar el inventario ';
            const serverError = err.response?.data?.error || '';
            const detalle = err.response?.data?.detalle || ''; //el error para el admin
            const codigo = err.response?.data?.codigo || ''; //codigo de error para el admin si existe  
            const errorText = typeof serverError === 'string' ? serverError : '';
            if(!err.response){
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            }
            else if(errorText.includes('getaddrinfo')){
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if(isAdmin){
                message += `${(detalle ?? ` | ${detalle} |`)}  ${(codigo ?? `| ${codigo} |`)}`;
            }
            showMessage('error', message);
        } finally {
            setLoading(false);
        }
    }

    async function openAddProduct() {
        showMessage('','');
        setActionLoading(true);
        setNewProduct({
            id_producto: '',
            id_departamento: usuario?.id_departamento,  
            cantidad_disponible: 0,
            cantidad_minima: 1,
        });
        try {
            setAddOpen(true);
        } catch (err) {
            const serverError = err.response?.data?.error ? err.response?.data?.error : '';
            const detalle = err.response?.data?.detalle ? err.response?.data?.detalle : ''
            const codigo = err.response?.data?.codigo ? err.response?.data?.codigo : ''
            let message = 'No se pudieron cargar los productos. ';
            if(!err.response){
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet. ';
            }

            else if (serverError.includes('getaddrinfo')){
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde. ';
            }
            if(isAdmin){
                message += ` ${detalle ?? ` | ${detalle} |`} ${codigo ?? ` | ${codigo} |`} `;
            }
            showMessage('error', message);
        } finally {
            setActionLoading(false);
        }
    }

    async function addProduct(event) {
        event.preventDefault();
        showMessage('','');
        if (!newProduct.id_producto) {
            showMessage('error', 'Selecciona un producto del catálogo.');
            return;
        }
        if (Number(newProduct.cantidad_minima) < 0 || Number(newProduct.cantidad_disponible) < 0) {
            showMessage('error', 'Las cantidades no pueden ser negativas.');
            return;
        }
        const existe = items.some((item) => 
            (Number(item.id_producto) === Number(newProduct.id_producto) &&
            Number(item.id_departamento) === Number(newProduct.id_departamento))
        )

        if(existe){
            const confirmar = window.confirm(
            'Este producto ya existe en el inventario de este departamento. ¿Deseas actualizarlo a los valores ingresados?'
        );
        
        if (!confirmar) {
            return; 
        }
        }
        setAddSaving(true);
        try {
                const departamentoNombre = departamentos.find((d) => d.id_departamento === Number(newProduct.id_departamento))?.nombre || departamentos.find((d) => d.id_departamento === Number(usuario?.id_departamento))?.nombre;
                await client.post('/inventario', {
                    id_producto: Number(newProduct.id_producto),
                    cantidad_disponible: Number(newProduct.cantidad_disponible),
                    cantidad_minima: Number(newProduct.cantidad_minima),
                    id_departamento: Number(newProduct.id_departamento),
                });
                await loadInventory();
                setAddOpen(false);
                showMessage('success', `Producto agregado al inventario de ${String(departamentoNombre) || 'tu departamento'}.`);
        } catch (err) {
            const serverError = err.response?.data?.error ? String(err.response?.data?.error) : '';
            const detalle = err.response?.data?.detalle ? String(err.response?.data?.detalle) : '';
            const codigo = err.response?.data?.codigo ? String(err.response?.data?.codigo) : '';
            
            let message = 'No se pudo agregar el producto al inventario.';
            if(!err.response){
                message= 'No se pudo conectar con el servidor. verifica tu conexión a internet.';
            } else if (serverError.includes('getaddrinfo')){
                message = 'No se pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            

            if(isAdmin){
                message += ` ${detalle ?? ` | ${detalle} |`} ${codigo ?? ` | ${codigo} |`}`;
            }
            showMessage('error', message);
        } finally {
            setAddSaving(false);
            setNewProduct({ id_producto: '', cantidad_disponible: 0, cantidad_minima: 1 });
        }
    }

    async function commitItem(item, field, value) {
        const amount = Number(value);
        if (!Number.isInteger(amount) || amount < 0) return;
        if (amount === Number(item[field])) return;
        if (usuario?.rol === 'usuario') return setError('No tienes permisos para modificar el inventario.');

        const departamentoUsuario = isSystems ? Number(item.id_departamento) : Number(usuario?.id_departamento);
            setSaving(prev => [...prev, item]);
        showMessage('','');
        try {
            const { data } = await client.patch(`/inventario/${item.id_inventario}`, {
                [field]: amount,
                id_departamento: departamentoUsuario,
            });
            setItems((prev) =>
                prev.map((current) =>
                    current.id_inventario === item.id_inventario ? { ...current, ...data } : current
                )
            );
        } catch (err) {
            const serverError = err.response?.data?.error ? err.response?.data?.error : '';
            const detalle = err.response?.data?.detalle ? err.response?.data?.detalle : ''
            const codigo = err.response?.data?.codigo ? err.response?.data?.codigo : ''
            const errorText = typeof serverError === 'string' ? serverError : '';
            let message = 'No se pudo actualizar los productos.';

            if(!err.response){
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            }
            else if(errorText.includes('getaddrinfo')){
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if(isSystems){
                message += `${detalle ?? ` | ${detalle} |`} ${codigo ?? ` | ${codigo} | `}`;
            }

            showMessage('error', message);
            setItems((prev) => [...prev]); // revierte el valor mostrado al del servidor
        } finally {
            setSaving(prev => prev.filter(id => id.id_inventario !== item.id_inventario));
        }
    }
    const estadoTexto = { ok: 'Disponible', low: 'Bajo mínimo', out: 'Agotado' };


    function estadoDe(item) {
        const disp = Number(item.cantidad_disponible);
        const min = Number(item.cantidad_minima);
        if (disp === 0) return 'out';
        if (disp <= min) return 'low';
        return 'ok';
    }

    const resumen = useMemo(() => {
        const total = items.length;
        let bajos = 0;
        let agotados = 0;
        let unidades = 0;
        items.forEach((item) => {
            const estado = estadoDe(item);
            if (estado === 'out') agotados += 1;
            else if (estado === 'low') bajos += 1;
            unidades += Number(item.cantidad_disponible) || 0;
        });
        return { total, bajos, agotados, unidades, sanos: total - bajos - agotados };
    }, [items]);

    function valorOrden(item, key) {
        switch (key) {
            case 'material':
                return normalizar(item.producto);
            case 'departamento':
                return normalizar(item.departamento);
            case 'marca':
                const texto = [item.marca, item.modelo].filter(Boolean).join(' ').trim()
                return texto || null;
            case 'disponible':
                return Number(item.cantidad_disponible);
            case 'estado':
                return normalizar(estadoDe(item));
            default:
                return item[key] ?? null;
        }
    }
//arreglar el sort para que muestre los elementos ordenados correctamente y no muestre primero 'HP SDA' y depues 'ASDSAD' y por ultimo 'HP'
    const visibles = useMemo(() => {
        const texto = search.trim().toLowerCase();

        const filtrados = items.filter((item) => {
            const userDepartamento = usuario?.departamento;
            const productoDepartamento = item.departamento;
            const estado = estadoDe(item);
            if (filterEstado === 'LOW' && estado !== 'low') return false;
            if (filterEstado === 'OUT' && estado !== 'out') return false;
            if (filterEstado === 'OK' && estado !== 'ok') return false;
            if (filterEstado === 'ATENCION' && estado === 'ok') return false;
            if(userDepartamento !== productoDepartamento && !isSystems) return false;
            if(filterDepartamento !== 'ALL' && Number(filterDepartamento) !== Number(item.id_departamento)) return false;
            if (!texto) return true;
            return [item.producto, item.marca, item.modelo]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(texto);
        });

        const peso = { out: 0, low: 1, ok: 2 };

        const lista = [...filtrados].sort((a, b) => {
            if (orden === 'NOMBRE') return (a.producto || '').localeCompare(b.producto || '');
            if (orden === 'EXISTENCIA') return Number(a.cantidad_disponible) - Number(b.cantidad_disponible);
            return peso[estadoDe(a)] - peso[estadoDe(b)];
        });

        const factor = sort.dir === 'asc' ? 1 : -1;

        return [...lista].sort((a, b) => {
            const va = valorOrden(a, sort.key);
            const vb = valorOrden(b, sort.key);

            
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;

            // Si ambos son strings, compara según el idioma local
            if (typeof va === 'string' && typeof vb === 'string') {
                return va.localeCompare(vb, 'es', { sensitivity: 'base', numeric: true }) * factor;
            }

            // Comparación numérica por si la columna es cantidad/precio
            if (va < vb) return -1 * factor;
            if (va > vb) return 1 * factor;
            return 0;
        });
    }, [items, search, filterEstado, orden, sort, filters, filterDepartamento]);

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

    const hayFiltros = search.trim() !== '' || filterEstado !== 'ALL';

    const renderStepper = (item, field) => {
        const valor = Number(item[field]) || 0;
        const bloqueado = 
            !canEdit // admin gerente o sistemas 
            || saving.some((s) => s.id_departamento === item.id_departamento && s.id_inventario === item.id_inventario)  || //se esta guardando el valor en el servidor
            (!canEdit && Number(item.id_departamento) !== Number(usuario?.id_departamento)) || // usuario de otro departamento
            usuario?.rol === 'usuario'; // usuario no puede modificar inventario
        return (
            <div className="inv-stepper">
                <button
                    type="button"
                    className="inv-stepper__btn"
                    onClick={() => commitItem(item, field, valor - 1)}
                    disabled={bloqueado || valor <= 0}
                    aria-label="Restar una unidad"
                >
                    <svg height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M6 12L18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg> 
                </button>
                <input
                    type="number"
                    min="0"
                    className="inv-stepper__input"
                    defaultValue={valor}
                    key={`${item.id_inventario}-${field}-${valor}`}
                    disabled={bloqueado}
                    onBlur={(event) => commitItem(item, field, event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                />
                <button
                    type="button"
                    className="inv-stepper__btn"
                    onClick={() => commitItem(item, field, valor + 1)}
                    disabled={bloqueado}
                    aria-label="Sumar una unidad"
                >
                    <svg height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M6 12H18M12 6V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
                </button>
            </div>
        );
    };

    const handleCloseModal = () => {
        setAddOpen(false);
        setNewProduct({ id_producto: '', id_departamento: usuario?.id_departamento, cantidad_disponible: 0, cantidad_minima: 1 });
    }

    const handleCloseDeleteModal = () => {
        setDeleteModalOpen(false);
        setItemToDelete(null);
        showMessage('','');
        setSaving(prev => prev.filter(id => id.id_inventario !== itemToDelete?.id_inventario));
    }

    const deleteItem = (item) => {
        setItemToDelete(item);
        setDeleteModalOpen(true);
    }

    async function removeItem(item) {
        if (!canEdit && (Number(item.id_departamento) !== Number(usuario?.id_departamento))) return;
        if(!item) return;

        setSaving(prev => [...prev, item]);
        showMessage('','');
        try {
            await client.delete(`/inventario/${item.id_inventario}`);
            setItems((prev) => prev.filter((current) => current.id_inventario !== item.id_inventario));
            showMessage('success', 'El producto se elimino correctamente');

        } catch (err) {
            const serverError = err.response?.data?.error ? String(err.response?.data?.error): '';
            const detalle = err.response?.data?.detalle ? String(err.response?.data?.detalle): '';
            const codigo = err.response?.data?.codigo ? String(err.response?.data?.codigo): '';
            let message = 'No se pudo eliminar el producto.';

            if(!err.response){
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (serverError.includes('getaddrinfo')){
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if (isAdmin){
                message = `${detalle ?? ` | ${detalle} |`} ${codigo ?? ` | ${codigo} |`}`;
            }
            showMessage('error', message);
        } finally {
            setSaving(prev => prev.filter(id => id.id_inventario !== item.id_inventario));
            setDeleteModalOpen(false);
            setItemToDelete(null);
        }
    }

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

    const inventarioRecivido = useCallback(()=>{
        const prod = searchParams.get('producto');
        const dep = searchParams.get('departamento');
        
        if(!prod && !dep) return;
        
        setSearch(prod);
        setFilterDepartamento(dep || 'ALL');
    }, [searchParams]);

    useEffect(()=>{
        inventarioRecivido();
    }, [inventarioRecivido]);



    return (
        <Layout>
            <main className="inv-container">
                <header className="inv-header">
                    <div>
                        <h1 className="inv-header__title">
                            <span className="inv-header__icon-box">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                    <line x1="12" y1="22.08" x2="12" y2="12" />
                                </svg>
                            </span>
                            Inventario
                        </h1>

                    </div>

                    <div className="inv-header__actions">
                        <button
                            type="button"
                            className="inv-btn inv-btn--secondary"
                            onClick={loadInventory}
                            disabled={loading}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'inv-btn__spin' : ''}>
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            <span>Actualizar</span>
                        </button>

                        {canEdit && (
                            <button type="button" className='inv-btn inv-btn--primary' onClick={openAddProduct} disabled={actionLoading}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Añadir producto</span>
                            </button>
                        )}
                    </div>
                </header>

                <div className="inv-kpis">

                    <div className="inv-kpi">
                        <div className="inv-kpi__icon-box inv-kpi__icon-box--blue">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                                </svg>
                        </div>
                        <div className="inv-kpi__content">
                            <div className="inv-kpi__label">Materiales</div>
                            <div className="inv-kpi__val">{loading ? '-' : resumen.unidades} </div>
                        </div>
                    </div>

                    <div className="inv-kpi">
                        <div className="inv-kpi__icon-box inv-kpi__icon-box--emerald">
                            <svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <div className="inv-kpi__content">
                            <div className="inv-kpi__label">Con existencia</div>
                            <div className="inv-kpi__val">{loading ? '-' : resumen.sanos}</div>
                        </div>
                    </div>

                        
                    <div className={`inv-kpi ${resumen.bajos > 0 ? 'inv-kpi-card--alerta' : ''}`}
                        role={resumen.bajos > 0 ? 'button' : undefined}
                        tabIndex={resumen.bajos > 0 ? 0 : undefined}
                        onClick={() => resumen.bajos > 0 && setFilterEstado('LOW')}
                        onKeyDown={(e) => e.key === 'Enter' && resumen.bajos > 0 && setFilterEstado('LOW')}>
                        <div className="inv-kpi__icon-box inv-kpi__icon-box--amber">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>
                        <div className="kpi-content">
                            <div className="inv-kpi__label">Bajo mínimo</div>
                            <div className="inv-kpi__val">{loading ? '-' :resumen.bajos}</div>
                        </div>
                    </div>

                    <div className={`inv-kpi ${resumen.agotados > 0 ? 'inv-kpi-card--critico' : ''}`}
                        role={resumen.agotados > 0 ? 'button' : undefined}
                        tabIndex={resumen.agotados > 0 ? 0 : undefined}
                        onClick={() => resumen.agotados > 0 && setFilterEstado('OUT')}
                        onKeyDown={(e) => e.key === 'Enter' && resumen.agotados > 0 && setFilterEstado('OUT')}>
                            <div className="inv-kpi__icon-box inv-kpi__icon-box--red">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>  
                            </div>
                            <div className="inv-kpi__content">
                                <div className="inv-kpi__label">Agotados</div>
                                <div className="inv-kpi__val">{loading ? '-' :resumen.agotados}</div>
                            </div>
                    </div>

                </div>

                {!canEdit && (
                    <div className="inv-alert inv-alert--warning">
                        <div className="inv-alert__content">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <span>
                                Estás viendo el inventario en modo lectura. Solo gerentes y administradores
                                pueden modificar el inventario de su departamento.
                            </span>
                        </div>
                    </div>
                )}

                {alerta}

                <div className="inv-filters">
                    <div className="inv-search-wrap">
                        <span className="inv-search-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="inv-search-input"
                            placeholder="Buscar material, marca o modelo"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        {search && (
                            <button type="button" className="inv-search-clear" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <select className="inv-select" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
                        <option value="ALL">Todos los estados</option>
                        
                        <option value="LOW">Bajo mínimo</option>
                        <option value="OUT">Agotados</option>
                        <option value="OK">Disponibles</option>
                    </select>

                    <select className="inv-select" value={filterDepartamento} onChange={(e) => setFilterDepartamento(e.target.value)}>
                        <option value="ALL">Todos los Departamentos</option>

                        {empresas.map((e) => {
                            const deps = departamentos.filter((d) => d.id_empresa === e.id_empresa);
                            return (
                                <optgroup key={e.id_empresa} label={e.nombre}>
                                    {deps.map((d) => {
                                        return (
                                            <option key={d.id_departamento} value={d.id_departamento}>
                                                {d.nombre}
                                            </option>
                                        )
                                    })}
                                </optgroup>
                            )
                        })
                        } 
                    </select>
                </div>
                <div className="inv-table-wrap">
                    {loading ? (
                        <div className="inv-loading">
                            <div className="inv-spinner" />
                            <span>Cargando inventario...</span>
                        </div>
                    ) : visibles.length === 0 ? (
                        <div className="inv-empty">
                            <span className="inv-empty__icon">
                                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                </svg>
                            </span>
                            <h3>{hayFiltros ? 'Sin coincidencias' : 'Aún no hay materiales'}</h3>
                            <p>
                                {hayFiltros
                                    ? 'Ningún material coincide con la búsqueda o el estado seleccionado.'
                                    : `Agrega el primer material para empezar a controlar las existencias de ${usuario?.departamento || 'tu departamento'}.`}
                            </p>
                            {hayFiltros ? (
                                <button
                                    type="button"
                                    className="inv-btn inv-btn--secondary"
                                    onClick={() => { setSearch(''); setFilterEstado('ALL'); }}
                                >
                                    Quitar filtros
                                </button>
                            ) : canEdit && (
                                <button type="button" className="inv-btn inv-btn--primary" onClick={openAddProduct}>
                                    Añadir producto
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="inv-table">
                            <thead>
                                <tr>
                                    <SortHeader label="Material" sortKey="material" sort={sort} onSort={toggleSort} />
                                    {isSystems && <SortHeader label="Departamento" sortKey="departamento" sort={sort} onSort={toggleSort} />}
                                    <SortHeader label="Marca / Modelo" sortKey="marca" sort={sort} onSort={toggleSort} />
                                    <SortHeader label="Disponible" sortKey="disponible" sort={sort} onSort={toggleSort} />
                                    <th title="Al llegar a este nivel, se creara una alerta" className="inv-col-min" >Mínimo 
                                        <svg  height="10px" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <g id="SVGRepo_bgCarrier" strokeWidth="0"/>
                                            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"/>
                                            <g id="SVGRepo_iconCarrier">
                                                <path fillRule="evenodd" clipRule="evenodd" d="M0.877075 7.49972C0.877075 3.84204 3.84222 0.876892 7.49991 0.876892C11.1576 0.876892 14.1227 3.84204 14.1227 7.49972C14.1227 11.1574 11.1576 14.1226 7.49991 14.1226C3.84222 14.1226 0.877075 11.1574 0.877075 7.49972ZM7.49991 1.82689C4.36689 1.82689 1.82708 4.36671 1.82708 7.49972C1.82708 10.6327 4.36689 13.1726 7.49991 13.1726C10.6329 13.1726 13.1727 10.6327 13.1727 7.49972C13.1727 4.36671 10.6329 1.82689 7.49991 1.82689ZM8.24993 10.5C8.24993 10.9142 7.91414 11.25 7.49993 11.25C7.08571 11.25 6.74993 10.9142 6.74993 10.5C6.74993 10.0858 7.08571 9.75 7.49993 9.75C7.91414 9.75 8.24993 10.0858 8.24993 10.5ZM6.05003 6.25C6.05003 5.57211 6.63511 4.925 7.50003 4.925C8.36496 4.925 8.95003 5.57211 8.95003 6.25C8.95003 6.74118 8.68002 6.99212 8.21447 7.27494C8.16251 7.30651 8.10258 7.34131 8.03847 7.37854L8.03841 7.37858C7.85521 7.48497 7.63788 7.61119 7.47449 7.73849C7.23214 7.92732 6.95003 8.23198 6.95003 8.7C6.95004 9.00376 7.19628 9.25 7.50004 9.25C7.8024 9.25 8.04778 9.00601 8.05002 8.70417L8.05056 8.7033C8.05924 8.6896 8.08493 8.65735 8.15058 8.6062C8.25207 8.52712 8.36508 8.46163 8.51567 8.37436L8.51571 8.37433C8.59422 8.32883 8.68296 8.27741 8.78559 8.21506C9.32004 7.89038 10.05 7.35382 10.05 6.25C10.05 4.92789 8.93511 3.825 7.50003 3.825C6.06496 3.825 4.95003 4.92789 4.95003 6.25C4.95003 6.55376 5.19628 6.8 5.50003 6.8C5.80379 6.8 6.05003 6.55376 6.05003 6.25Z" fill="currentColor"/>
                                            </g>
                                        </svg>
                                        </th>
                                    <SortHeader label="Estado" sortKey="estado" sort={sort} onSort={toggleSort} />
                                    {canEdit && <th>Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((item) => {
                                    const estado = estadoDe(item);
                                    const puedeEditarItem = canEdit && Number(item.id_departamento) === Number(usuario?.id_departamento) || isSystems;
                                    return (
                                        <tr key={item.id_inventario} className={saving === item.id_inventario ? 'inv-row--saving' : ''}>
                                            <td data-label="Material">
                                                <div className="inv-table__main">{item.producto}</div>
                                                <div className="inv-table__sub inv-only-mobile">
                                                    {[item.marca, item.modelo].filter(Boolean).join(' · ') || 'Sin marca registrada'}
                                                </div>
                                            </td>
                                            {isSystems && (
                                                <td data-label="Departamento">
                                                    <div className="inv-table__main">{item.departamento || '—'}</div>
                                                </td>
                                            )}
                                            <td className="inv-col-modelo" data-label="Marca / modelo">
                                                {[item.marca, item.modelo].filter(Boolean).join(' · ') || '—'}
                                            </td>
                                            <td data-label="Disponible">
                                                {renderStepper(item, 'cantidad_disponible')}
                                            </td>
                                            <td className="inv-col-min" data-label="Mínimo">
                                                {renderStepper(item, 'cantidad_minima')}
                                            </td>
                                            <td data-label="Estado">
                                                <span className={`inv-badge inv-badge--${estado}`}>{estadoTexto[estado]}</span>
                                            </td>
                                            {canEdit && (
                                                <td data-label="Acciones">
                                                    {puedeEditarItem ? (
                                                        <button
                                                            type="button"
                                                            className="inv-btn inv-btn--danger"
                                                            onClick={() => deleteItem(item)}
                                                            disabled={saving === item.id_inventario}
                                                        >
                                                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                                                                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                                                                <g id="SVGRepo_iconCarrier">
                                                                    <path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    </path>
                                                                </g>
                                                            </svg>
                                                        </button>
                                                    ) : (
                                                        <span className="inv-table__sub">Solo lectura</span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
                {addOpen && (
                    <div className="inv-modal-overlay" onClick={() => !addSaving && setAddOpen(false)}>
                        <form className="inv-modal" onSubmit={addProduct} onClick={(event) => event.stopPropagation()}>
                            <div className="inv-modal__header">
                                <h2 className="inv-modal__title">Añadir producto a {newProduct.id_departamento ? departamentos.find((d) => d.id_departamento === Number(newProduct.id_departamento))?.nombre : 'tu departamento'}</h2>
                                <button type="button" className="inv-modal__close" onClick={() => handleCloseModal()} disabled={addSaving} aria-label="Cerrar">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                            <div className="inv-modal__form">
                                {alerta}
                                <div className="inv-form-group">
                                    <label className="inv-label" htmlFor="inv-departamento">Departamento</label>
                                    <select 
                                    id="inv-departamento" 
                                    className="inv-input" 
                                    value={newProduct.id_departamento} 
                                    onChange={(event) => setNewProduct({ ...newProduct, id_departamento: event.target.value })} 
                                    required 
                                    disabled={!isSystems}>  
                                        {departamentos.map((d) => (
                                            <option key={d.id_departamento} value={d.id_departamento}>{d.nombre} · {empresas.find((e) => (e.id_empresa === d.id_empresa) || '').nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="inv-form-group">
                                    <label className="inv-label" htmlFor="inv-producto">Producto</label>
                                    <select
                                        id="inv-producto"
                                        className="inv-input"
                                        value={newProduct.id_producto}
                                        onChange={(event) => setNewProduct({ ...newProduct, id_producto: event.target.value })}
                                        required
                                    >
                                        <option value="">Selecciona un producto</option>
                                        {productos.map((producto) => (
                                            <option key={producto.id_producto} value={producto.id_producto}>
                                                {producto.nombre}{producto.marca ? ` · ${producto.marca}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="inv-modal__hint">
                                        Si el producto no aparece en la lista, primero se debe registrar en la sección de <strong><a href="/productos" target="_blank" rel="noopener noreferrer">Productos</a> </strong>.
                                    </p>
                                </div>
                                <div className="inv-grid-2">
                                    <div className="inv-form-group">
                                        <label className="inv-label" htmlFor="inv-inicial">Existencia inicial</label>
                                        <input
                                            id="inv-inicial"
                                            className="inv-input"
                                            type="number"
                                            min="0"
                                            value={newProduct.cantidad_disponible}
                                            onChange={(event) => setNewProduct({ ...newProduct, cantidad_disponible: event.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="inv-form-group">
                                        <label className="inv-label" htmlFor="inv-minima">Existencia mínima</label>
                                        <input
                                            id="inv-minima"
                                            className="inv-input"
                                            type="number"
                                            min="0"
                                            value={newProduct.cantidad_minima}
                                            onChange={(event) => setNewProduct({ ...newProduct, cantidad_minima: event.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="inv-modal__footer">
                                <button type="button" className="inv-btn inv-btn--secondary" onClick={() => setAddOpen(false)} disabled={addSaving}>
                                    Cancelar
                                </button>
                                <button type="submit" className="inv-btn inv-btn--primary" disabled={addSaving}>
                                    {addSaving ? 'Guardando...' : 'Guardar producto'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                {deleteModalOpen && (
                    <div className="inv-modal-overlay" onClick={() => handleCloseDeleteModal()}>
                        <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="inv-modal__header">
                                <h2 className="inv-modal__title">Eliminar producto</h2>
                                <span className="inv-modal__close" onClick={() => handleCloseDeleteModal()} aria-label="Cerrar">
                                    <svg width="12px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <g id="SVGRepo_bgCarrier" strokeWidth="0"/>
                                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"/>
                                        <g id="SVGRepo_iconCarrier">
                                            <path d="M20.7457 3.32851C20.3552 2.93798 19.722 2.93798 19.3315 3.32851L12.0371 10.6229L4.74275 3.32851C4.35223 2.93798 3.71906 2.93798 3.32854 3.32851C2.93801 3.71903 2.93801 4.3522 3.32854 4.74272L10.6229 12.0371L3.32856 19.3314C2.93803 19.722 2.93803 20.3551 3.32856 20.7457C3.71908 21.1362 4.35225 21.1362 4.74277 20.7457L12.0371 13.4513L19.3315 20.7457C19.722 21.1362 20.3552 21.1362 20.7457 20.7457C21.1362 20.3551 21.1362 19.722 20.7457 19.3315L13.4513 12.0371L20.7457 4.74272C21.1362 4.3522 21.1362 3.71903 20.7457 3.32851Z" fill="currentColor"/>
                                        </g>
                                    </svg>
                                </span>
                            </div>
                            <div className="inv-form-group">
                                <p>¿Estás seguro que quieres eliminar el producto:</p>
                                <table className="inv-table inv-table-delete">
                                    <thead>
                                        <tr>
                                            <th>Material</th>
                                            <th>Departamento</th>
                                            <th>Marca / Modelo</th>
                                            <th>Disponible</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td data-label="Material">
                                                {itemToDelete?.producto}
                                            </td>
                                            <td data-label="Departamento">
                                                {itemToDelete?.departamento}
                                            </td>
                                            <td data-label="Marca / Modelo">
                                                {[itemToDelete.marca, itemToDelete.modelo].filter(Boolean).join(' · ') || '—'}
                                            </td>
                                            <td>
                                                {itemToDelete?.cantidad_disponible}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="inv-modal__footer">
                                <button type="button" className="inv-btn inv-btn--secondary" onClick={()=> handleCloseDeleteModal()}>
                                    Cancelar
                                </button>
                                <button type="button" className="inv-btn inv-btn--danger" onClick={() => removeItem(itemToDelete)}>
                                    {saving.some((s)=> s.id_inventario === itemToDelete.id_inventario) ? 'Eliminando...' : 'Eliminar Producto'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </Layout>
    );
}

export default Inventario;