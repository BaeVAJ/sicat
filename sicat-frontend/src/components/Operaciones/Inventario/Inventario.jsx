import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import Layout from '../../layout/Layout';
import './Inventario.css';

const DEPARTAMENTO_SISTEMAS = 1;

function Inventario() {
    const { usuario } = useAuth();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [saving, setSaving] = useState(null);

    const [productos, setProductos] = useState([]);
    const [addOpen, setAddOpen] = useState(false);
    const [addSaving, setAddSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [newProduct, setNewProduct] = useState({
        id_producto: '',
        cantidad_disponible: 0,
        cantidad_minima: 1,
    });

    const [search, setSearch] = useState('');
    const [filterEstado, setFilterEstado] = useState('ALL');
    const [orden, setOrden] = useState('CRITICO');

    const isSystems = Number(usuario?.id_departamento) === DEPARTAMENTO_SISTEMAS;
    const canEdit = ['admin', 'gerente'].includes(usuario?.rol);

    useEffect(() => {
        queueMicrotask(loadInventory);
    }, []);

    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => setSuccess(''), 4000);
        return () => clearTimeout(timer);
    }, [success]);

    async function loadInventory() {
        setLoading(true);
        setError('');
        try {
            const { data } = await client.get('/inventario');
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(
                err.response?.data?.error ||
                'No se pudo cargar el inventario de tu departamento.'
            );
        } finally {
            setLoading(false);
        }
    }

    async function openAddProduct() {
        setError('');
        setFormError('');
        try {
            const { data } = await client.get('/productos');
            setProductos(Array.isArray(data) ? data : []);
            setAddOpen(true);
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudieron cargar los productos.');
        }
    }

    async function addProduct(event) {
        event.preventDefault();
        setFormError('');

        if (!newProduct.id_producto) {
            setFormError('Selecciona un producto del catálogo.');
            return;
        }
        if (Number(newProduct.cantidad_minima) < 0 || Number(newProduct.cantidad_disponible) < 0) {
            setFormError('Las cantidades no pueden ser negativas.');
            return;
        }

        setAddSaving(true);
        try {
            await client.post('/inventario', {
                id_producto: Number(newProduct.id_producto),
                cantidad_disponible: Number(newProduct.cantidad_disponible),
                cantidad_minima: Number(newProduct.cantidad_minima),
                id_departamento: Number(usuario?.id_departamento),
            });
            await loadInventory();
            setAddOpen(false);
            setNewProduct({ id_producto: '', cantidad_disponible: 0, cantidad_minima: 1 });
            setSuccess(`Producto agregado al inventario de ${usuario?.departamento || 'tu departamento'}.`);
        } catch (err) {
            setFormError(err.response?.data?.error || 'No se pudo agregar el producto al inventario.');
        } finally {
            setAddSaving(false);
        }
    }

    // Guarda solo cuando el usuario confirma (blur / Enter / stepper),
    // no en cada pulsación de tecla.
    async function commitItem(item, field, value) {
        const amount = Number(value);
        if (!Number.isInteger(amount) || amount < 0) return;
        if (amount === Number(item[field])) return;

        setSaving(item.id_inventario);
        setError('');
        try {
            const { data } = await client.patch(`/inventario/${item.id_inventario}`, {
                [field]: amount,
                id_departamento: Number(usuario?.id_departamento),
            });
            setItems((prev) =>
                prev.map((current) =>
                    current.id_inventario === item.id_inventario ? { ...current, ...data } : current
                )
            );
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo actualizar el inventario.');
            setItems((prev) => [...prev]); // revierte el valor mostrado al del servidor
        } finally {
            setSaving(null);
        }
    }

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

    const visibles = useMemo(() => {
        const texto = search.trim().toLowerCase();
        const filtrados = items.filter((item) => {
            const estado = estadoDe(item);
            if (filterEstado === 'LOW' && estado !== 'low') return false;
            if (filterEstado === 'OUT' && estado !== 'out') return false;
            if (filterEstado === 'OK' && estado !== 'ok') return false;
            if (filterEstado === 'ATENCION' && estado === 'ok') return false;

            if (!texto) return true;
            return [item.producto, item.marca, item.modelo]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(texto);
        });

        const peso = { out: 0, low: 1, ok: 2 };
        return [...filtrados].sort((a, b) => {
            if (orden === 'NOMBRE') return (a.producto || '').localeCompare(b.producto || '');
            if (orden === 'EXISTENCIA') return Number(a.cantidad_disponible) - Number(b.cantidad_disponible);
            return peso[estadoDe(a)] - peso[estadoDe(b)];
        });
    }, [items, search, filterEstado, orden]);

    const hayFiltros = search.trim() !== '' || filterEstado !== 'ALL';

    const estadoTexto = { ok: 'Disponible', low: 'Bajo mínimo', out: 'Agotado' };

    const renderStepper = (item, field) => {
        const valor = Number(item[field]) || 0;
        const bloqueado = !canEdit ||
            Number(item.id_departamento) !== Number(usuario?.id_departamento) ||
            saving === item.id_inventario;
        return (
            <div className="inv-stepper">
                <button
                    type="button"
                    className="inv-stepper__btn"
                    onClick={() => commitItem(item, field, valor - 1)}
                    disabled={bloqueado || valor <= 0}
                    aria-label="Restar una unidad"
                >
                    −
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
                    +
                </button>
            </div>
        );
    };

    async function removeItem(item) {
        if (!canEdit || Number(item.id_departamento) !== Number(usuario?.id_departamento)) return;
        if (!window.confirm(`¿Eliminar "${item.producto}" del inventario?`)) return;

        setSaving(item.id_inventario);
        setError('');
        try {
            await client.delete(`/inventario/${item.id_inventario}`);
            setItems((prev) => prev.filter((current) => current.id_inventario !== item.id_inventario));
            setSuccess('Producto eliminado del inventario.');
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo eliminar el producto del inventario.');
        } finally {
            setSaving(null);
        }
    }

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
                            <button type="button" className="inv-btn inv-btn--primary" onClick={openAddProduct}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Añadir producto</span>
                            </button>
                        )}
                    </div>
                </header>

                <section className="inv-kpis">
                    <article className="inv-kpi-card">
                        <div className="inv-kpi-card__top">
                            <span className="inv-kpi-card__label">Materiales</span>
                            <span className="inv-kpi-card__icon inv-kpi-card__icon--blue">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                                </svg>
                            </span>
                        </div>
                        <span className="inv-kpi-card__val">{loading ? '—' : resumen.total}</span>
                        <span className="inv-kpi-card__sub">{resumen.unidades} unidades en total</span>
                    </article>

                    <article className="inv-kpi-card">
                        <div className="inv-kpi-card__top">
                            <span className="inv-kpi-card__label">Con existencia</span>
                            <span className="inv-kpi-card__icon inv-kpi-card__icon--green">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </span>
                        </div>
                        <span className="inv-kpi-card__val">{loading ? '—' : resumen.sanos}</span>
                        <span className="inv-kpi-card__sub">Por encima del mínimo</span>
                    </article>

                    <article
                        className={`inv-kpi-card ${resumen.bajos > 0 ? 'inv-kpi-card--alerta' : ''}`}
                        role={resumen.bajos > 0 ? 'button' : undefined}
                        tabIndex={resumen.bajos > 0 ? 0 : undefined}
                        onClick={() => resumen.bajos > 0 && setFilterEstado('LOW')}
                        onKeyDown={(e) => e.key === 'Enter' && resumen.bajos > 0 && setFilterEstado('LOW')}
                    >
                        <div className="inv-kpi-card__top">
                            <span className="inv-kpi-card__label">Bajo mínimo</span>
                            <span className="inv-kpi-card__icon inv-kpi-card__icon--amber">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            </span>
                        </div>
                        <span className="inv-kpi-card__val">{loading ? '—' : resumen.bajos}</span>
                        <span className="inv-kpi-card__sub">Conviene reponer pronto</span>
                    </article>

                    <article
                        className={`inv-kpi-card ${resumen.agotados > 0 ? 'inv-kpi-card--critico' : ''}`}
                        role={resumen.agotados > 0 ? 'button' : undefined}
                        tabIndex={resumen.agotados > 0 ? 0 : undefined}
                        onClick={() => resumen.agotados > 0 && setFilterEstado('OUT')}
                        onKeyDown={(e) => e.key === 'Enter' && resumen.agotados > 0 && setFilterEstado('OUT')}
                    >
                        <div className="inv-kpi-card__top">
                            <span className="inv-kpi-card__label">Agotados</span>
                            <span className="inv-kpi-card__icon inv-kpi-card__icon--red">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                            </span>
                        </div>
                        <span className="inv-kpi-card__val">{loading ? '—' : resumen.agotados}</span>
                        <span className="inv-kpi-card__sub">Sin unidades disponibles</span>
                    </article>
                </section>

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

                {error && (
                    <div className="inv-alert inv-alert--error">
                        <div className="inv-alert__content">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>{error}</span>
                        </div>
                        <button type="button" className="inv-alert__close" onClick={() => setError('')} aria-label="Cerrar aviso">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {success && (
                    <div className="inv-alert inv-alert--success">
                        <div className="inv-alert__content">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <span>{success}</span>
                        </div>
                        <button type="button" className="inv-alert__close" onClick={() => setSuccess('')} aria-label="Cerrar aviso">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

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

                    <select className="inv-select" value={filterEstado} onChange={(event) => setFilterEstado(event.target.value)}>
                        <option value="ALL">Todos los estados</option>
                        <option value="ATENCION">Requieren atención</option>
                        <option value="LOW">Bajo mínimo</option>
                        <option value="OUT">Agotados</option>
                        <option value="OK">Disponibles</option>
                    </select>

                    <select className="inv-select" value={orden} onChange={(event) => setOrden(event.target.value)}>
                        <option value="CRITICO">Primero lo crítico</option>
                        <option value="NOMBRE">Por nombre</option>
                        <option value="EXISTENCIA">Por existencia</option>
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
                                    <th>Material</th>
                                    {isSystems && <th>Departamento</th>}
                                    <th className="inv-col-modelo">Marca / modelo</th>
                                    <th>Disponible</th>
                                    <th className="inv-col-min">Mínimo</th>
                                    <th>Estado</th>
                                    {canEdit && <th>Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((item) => {
                                    const estado = estadoDe(item);
                                    const puedeEditarItem = canEdit &&
                                        Number(item.id_departamento) === Number(usuario?.id_departamento);
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
                                                            onClick={() => removeItem(item)}
                                                            disabled={saving === item.id_inventario}
                                                        >
                                                            Eliminar
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
                                <h2 className="inv-modal__title">Añadir producto a Sistemas</h2>
                                <button type="button" className="inv-modal__close" onClick={() => setAddOpen(false)} disabled={addSaving} aria-label="Cerrar">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <div className="inv-modal__form">
                                {formError && (
                                    <div className="inv-form-alert">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        <span>{formError}</span>
                                    </div>
                                )}

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
                                <p className="inv-modal__hint">
                                    Cuando la existencia baje hasta el mínimo, el material aparecerá marcado para reposición.
                                </p>
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
            </main>
        </Layout>
    );
}

export default Inventario;