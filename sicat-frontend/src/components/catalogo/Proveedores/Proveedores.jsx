import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import Layout from '../../layout/Layout';
import './Proveedores.css';

function Proveedores() {
    const { usuario } = useAuth();
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [search, setSearch] = useState('');
    const [filterPago, setFilterPago] = useState('ALL');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('CREATE');
    const [selectedProveedor, setSelectedProveedor] = useState('');
    const [formNombre, setFormNombre] = useState('');
    const [formTelefono, setFormTelefono] = useState('');
    const [formCorreo, setFormCorreo] = useState('');
    const [formTipoPago, setFormTipoPago] = useState('');
    const [formError, setFormError] = useState('')

    const [ provToDelete, setProvToDelete ] = useState(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    const isAdmin = (usuario?.rol || '').toLowerCase() === 'admin'
    const isGerente = (usuario?.rol || '').toLowerCase() === 'gerente'
    const canManage = isAdmin || isGerente;
    useEffect(() => {
        fetchProveedores();
    }, []);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    const fetchProveedores = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const res = await client.get('/proveedores');
            setProveedores(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cargar los proveedores' || err.message);
        } finally {
            setLoading(false);
        }
    }
    const formatPhone = (phone) => {
        if (!phone) return '';
        const clean = String(phone).replace(/\D/g, '');
        if (clean.length === 10) {
            return `${clean.slice(0, 2)} ${clean.slice(2, 6)} ${clean.slice(6)}`;
        }
        return clean;
    };
    const filteredProveedores = useMemo(() => {
        return proveedores.filter((p) => {
            const matchesSearch = (p.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.telefono || '').includes(search) ||
                String(p.id_proveedor || '').includes(search);

            const matchesPago =
                filterPago === "ALL" || (p.tipo_pago || '').toLowerCase() === filterPago.toLowerCase();

            return matchesSearch && matchesPago;
        });
    }, [proveedores, search, filterPago]);

    const handleOpenCreate = () => {
        setModalMode('CREATE');
        setSelectedProveedor(null);
        setFormNombre('');
        setFormTelefono('');
        setFormCorreo('');
        setFormTipoPago('Transferencia');
        setFormError('');
        setModalOpen(true);
    }

    const handleOpenEdit = (proveedor) => {
        setModalOpen(true);
        setModalMode('EDIT');
        setFormNombre(proveedor.nombre || '-');
        setFormTelefono(proveedor.telefono || '-');
        setFormCorreo(proveedor.email || '-');
        setFormTipoPago(proveedor.tipo_pago || '-');
        setFormError('');
        setSelectedProveedor(proveedor);
    }

    const handleSave = async (e) => {
        e.preventDefault();

        setFormError('');

        if (!formNombre || !formTelefono || !formCorreo || !formTipoPago) {
            setFormError('Todos los campos son obligatorios');
            return;
        }

        const cleanPhone = formTelefono.replace(/\D/g, '');

        if (formTelefono.trim() && cleanPhone.length !== 10) {
            setFormError('El teléfono debe tener 10 dígitos');
            return;
        }

        setActionLoading(true);
        try {
            const payload = {
                nombre: formNombre,
                telefono: cleanPhone,
                email: formCorreo,
                tipo_pago: formTipoPago
            }
            if (modalMode === 'CREATE') {
                await client.post('/proveedores', payload);
                setSuccess('Proveedor creado correctamente');
            }
            if (modalMode === 'EDIT') {
                await client.put(`/proveedores/${selectedProveedor.id_proveedor}`, payload);
                setSuccess('Proveedor actualizado correctamente');
            }
            setModalOpen(false);
            fetchProveedores();
        } catch (err) {
            setFormError(err.response?.data?.error || 'Error al guardar el proveedor' || err.message);
        } finally {
            setActionLoading(false);
        }
    }

    const handleOpenDelete = (proveedor) => {
        setProvToDelete(proveedor);
        setDeleteModalOpen(true);
    }

    const handleDeleteConfirm = async () => {
        if (!provToDelete) return;

        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            await client.delete(`/proveedores/${provToDelete.id_proveedor}`);
            setSuccess(`Proveedor ${provToDelete.nombre} - ${provToDelete.id_proveedor} eliminado correctamente`);
            setDeleteModalOpen(false);
            setProvToDelete(null);
            fetchProveedores();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al eliminar el proveedor' || err.message);
            setDeleteModalOpen(false);
            setProvToDelete(null);
        } finally {
            setActionLoading(false);
        }
    }

    const proveedoresTotal = filteredProveedores.length;
    const transferenciaTotal = filteredProveedores.filter((p) => (p.tipo_pago === 'Transferencia')).length;
    const creditoTotal = filteredProveedores.filter((p) => (p.tipo_pago === 'Credito')).length;
    const contadoChequeTotal = filteredProveedores.filter((p) => (p.tipo_pago === 'Contado' || p.tipo_pago === 'Cheque')).length;

    return (
        <Layout>
            <div className="prov-container">
                <div className="prov-header">
                    <div>
                        <h1 className="prov-header__title">
                            <span className="prov-header__icon-box">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                                    <path d="M15 18H9" />
                                    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                                    <circle cx="17" cy="18" r="2" />
                                    <circle cx="7" cy="18" r="2" />
                                </svg>
                            </span>
                            Proveedores
                        </h1>
                        <p className="prov-header__subtitle">
                            Registro de distribuidores
                        </p>
                    </div>              
                        <div className="prov-header__actions">
                            <button className="prov-btn prov-btn--secondary prov-btn--icon-only"
                                type="button"
                                title="Recargar proveedores"
                                onClick={fetchProveedores}
                                disabled={loading || actionLoading}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
                                </svg>
                            </button>

                            {canManage && (
                                <button className="prov-btn prov-btn--primary"
                                    title="Agregar proveedor"
                                    type="button"
                                    onClick={handleOpenCreate}
                                    disabled={loading || actionLoading || !canManage}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Nuevo proveedor
                                </button>
                            )}
                        </div>
                    </div>
                    {error && (
                        <div className="prov-alert prov-alert--error">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="prov-alert prov-alert--success">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            {success}
                        </div>
                    )}
                
                <div className="prov-kpis">
                    <div className="prov-kpi">
                        <div className="prov-kpi__icon-box prov-kpi__icon-box--cyan">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                                <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                                <circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
                            </svg>
                        </div>
                        <div className="prov-kpi__content" >
                            <div className="prov-kpi__label"> Total de proveedores</div>
                            <div className="prov-kpi__value">
                                {proveedoresTotal}
                            </div>
                        </div>
                    </div>

                    <div className="prov-kpi">
                        <div className="prov-kpi__icon-box prov-kpi__icon-box--blue">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="5" width="20" height="14" rx="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                        </div>
                        
                        <div className="prov-kpi__content" >
                            <div className="prov-kpi__label"> Transferencia</div>
                            <div className="prov-kpi__value">
                                {transferenciaTotal}
                            </div>
                        </div>
                    </div>

                    <div className="prov-kpi">
                        <div className="prov-kpi__icon-box prov-kpi__icon-box--amber">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 14 14" />
                            </svg>
                        </div>
                        <div className="prov-kpi__content">
                            <div className="prov-kpi__label">Credito</div>
                            <div className="prov-kpi__value">
                                {creditoTotal}
                        </div>
                        </div>
                    </div>
                    <div className="prov-kpi">
                        <div className="prov-kpi__icon-box prov-kpi__icon-box--emerald">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="1" x2="12" y2="23" />
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                        </div>
                        <div className="prov-kpi__content">
                            <div className="prov-kpi__label">Cheque / Contado</div>
                            <div className="prov-kpi__value">
                                {contadoChequeTotal}
                        </div>
                        </div>
                    </div>
                </div>

                <div className="prov-controls">
                    <div className="prov-search">
                        <span className="prov-search__icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="prov-search__input"
                            placeholder="buscar proveedor por nombre, correo, teléfono o ID"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="prov-select"
                        value={filterPago}
                        onChange={(e) => setFilterPago(e.target.value)}
                    >
                        <option value="ALL">Todos los Tipos de Pago</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Credito">Crédito</option>
                        <option value="Contado">Contado</option>
                        <option value="Cheque">Cheque</option>
                    </select>
                </div>
                <div className="prov-table-wrapper">
                    <div className="prov-table-scroll">
                        <table className="prov-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Proveedor</th>
                                    <th>Telefono</th>
                                    <th>Correo Electronico</th>
                                    <th>Tipo de Pago</th>
                                    {canManage && (
                                        <th>Acciones</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ?(
                                    <tr>
                                        <td colSpan={canManage ? 6 : 5} style={{ textAlign: 'center', padding: '3rem' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', color: '#94a3b8' }}>
                                                <svg style={{ animation: 'spin 1s linear infinite' }} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                                                </svg>
                                                Cargando proveedores...
                                            </div>
                                        </td>
                                    </tr>
                                ): filteredProveedores.length === 0 ?(
                                    <tr>
                                        <td colSpan={canManage ? 6 : 5}>
                                            <div className="prov-empty">
                                                <div className="prov-empty__icon">
                                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                                                        <circle cx="17" cy="18" r="2" />
                                                    </svg>
                                                </div>
                                                <div className="prov-empty__title">No se encontraron proveedores</div>
                                                <div className="prov-empty__desc">
                                                    {search || filterPago !== 'ALL'
                                                        ? 'Intenta ajustar los criterios de búsqueda o el filtro.'
                                                        : 'Aún no hay proveedores registrados en el catálogo.'}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProveedores.map((prov) => {
                                        const tipoKey = (prov.tipo_pago || 'transferencia').toLowerCase();
                                        const initial = (prov.nombre || 'P').charAt(0).toUpperCase();

                                        return (
                                            <tr key={prov.id_proveedor}>
                                                <td style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                                                    #{prov.id_proveedor}
                                                </td>
                                                <td>
                                                    <div className="prov-cell-entity">
                                                        <div className="prov-avatar">{initial}</div>
                                                        <span className="prov-entity-name">{prov.nombre}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {prov.telefono ? (
                                                        <a href={`tel:${prov.telefono}`} className="prov-link">
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                                            </svg>
                                                            {formatPhone(prov.telefono)}
                                                        </a>
                                                    ) : (
                                                        <span style={{ color: '#64748b' }}>—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {prov.email ? (
                                                        <a href={`mailto:${prov.email}`} className="prov-link">
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                                            </svg>
                                                            {prov.email}
                                                        </a>
                                                    ) : (
                                                        <span style={{ color: '#64748b' }}>—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`prov-badge prov-badge--${tipoKey}`} onClick={() => setFilterPago(prov.tipo_pago)}>
                                                        {prov.tipo_pago || 'Transferencia'}
                                                    </span>
                                                </td>
                                                {canManage && (
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div className="prov-row-actions">
                                                            <button
                                                                type="button"
                                                                className="prov-action-btn prov-action-btn--edit"
                                                                onClick={() => handleOpenEdit(prov)}
                                                                title="Editar proveedor"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="prov-action-btn prov-action-btn--delete"
                                                                onClick={() => handleOpenDelete(prov)}
                                                                title="Eliminar proveedor"
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
                    <div className="prov-table-footer">
                        <span>
                            Mostrando <strong>{filteredProveedores.length}</strong> de <strong>{proveedores.length}</strong> proveedores
                        </span>
                        {filterPago !== 'ALL' && <span>Filtro activo: {filterPago}</span>}
                    </div>
                </div>
                {modalOpen && (
                    <div className="prov-modal-overlay" onClick={() => !actionLoading && setModalOpen(false)}>
                        <div className="prov-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="prov-modal__header">
                                <h2 className="prov-modal__title">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path><path d="M15 18H9"></path><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"></path><circle cx="17" cy="18" r="2"></circle><circle cx="7" cy="18" r="2"></circle></svg>
                                    {modalMode === 'CREATE' ? 'Nuevo Proveedor' : 'Editar Proveedor'}
                                </h2>
                                <button
                                type="button"
                                className="prov-modal__close"
                                onClick={()=> setModalOpen(false)}
                                disabled={actionLoading || !modalOpen}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                            <form className="prov-modal__form" onSubmit={handleSave}>
                                <div className="prov-modal__body">
                                    {formError && (
                                        <div className="prov-alert prov-alert--error" style={{ marginBottom: 0 }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                            <span>{formError}</span>
                                        </div>
                                    )}
                                    <div className="prov-form-group">
                                        <label className="prov-form-label">
                                            Nombre comercial o razón social
                                        </label>
                                        <input 
                                        type="text"
                                        className="prov-input"
                                        placeholder="ej. Proveedor S.A. de C.V."
                                        value={formNombre}
                                        onChange={(e) => setFormNombre(e.target.value)}
                                        disabled={actionLoading}
                                        required
                                        />
                                    </div>
                                    <div className="prov-form-group">
                                        <label className="prov-form-label">Teléfono</label>
                                        <input
                                        type="tel"
                                        className="prov-input"
                                        placeholder="ej. 123 456 7891"
                                        value={formTelefono}
                                        onChange={(e) => setFormTelefono(e.target.value)}
                                        disabled={actionLoading}
                                        maxLength="10"
                                        />
                                    </div>
                                    <div className="prov-form-group">
                                        <label className="prov-form-label">Correo electrónico</label>
                                        <input
                                        className='prov-input'
                                        type="email"
                                        placeholder="Ej. proveedor@gmail.com"
                                        value={formCorreo}
                                        onChange={(e) => setFormCorreo(e.target.value)}
                                        disabled={actionLoading}/>
                                    </div>
                                    <div className="prov-form-group">
                                        <label className="prov-form-label">Tipo de pago</label>
                                        <select className="prov-select" value={formTipoPago} onChange={(e) => setFormTipoPago(e.target.value)} required disabled={actionLoading} style={{ width: '100%' }}>
                                            <option value="Transferencia"> Transferencia</option>
                                            <option value="Credito"> Crédito</option>
                                            <option value="Contado"> Contado</option>
                                            <option value="Cheque"> Cheque</option>
                                        </select>
                                        <span className="prov-hint">
                                            Condición habitual convenida para la liquidación de compras.
                                        </span>
                                    </div>
                                </div>
                                <div className="prov-modal__footer">
                                    <button
                                    className="prov-btn prov-btn--secondary"
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    disabled={actionLoading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                    className="prov-btn prov-btn--primary"
                                    type="submit"
                                    disabled={actionLoading || !formNombre.trim()}>
                                        {actionLoading ? ('Guardando...') : (modalMode === 'CREATE' ? 'Guardar proveedor' : 'Actualizar proveedor')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {deleteModalOpen && provToDelete && (
                    <div className="prov-modal-overlay" onClick={()=> !actionLoading && setDeleteModalOpen(false)}>
                        <div className="prov-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="prov-modal__header">
                                <h2 className="prov-modal__title" style={{color:'#f87171'}}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                    Eliminar Proveedor
                                </h2>
                                <button
                                type="button"
                                className="prov-modal__close"
                                onClick={()=> setDeleteModalOpen(false)}
                                disabled={actionLoading}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                            <div className="prov-modal__body">
                                <p style={{color:'#e2e8f0', margin:0, fontSize:'0.9rem'}}>
                                    ¿Estás seguro de que deseas eliminar al proveedor <strong>{provToDelete.nombre}</strong> (ID: {provToDelete.id_proveedor})? Esta acción no se puede deshacer.
                                </p>
                                <div className="prov-delete-box">
                                    <strong>Advertencia:</strong> Si el proveedor tiene compras registradas o facturas vinculadas, no se podrá eliminar.    
                                </div>
                            </div>
                            <div className="prov-modal__footer">
                                <button
                                className="prov-btn prov-btn--secondary"
                                type="button"
                                onClick={() => setDeleteModalOpen(false)}
                                disabled={actionLoading}
                                >
                                    Cancelar
                                </button>
                                <button
                                className="prov-btn prov-btn--danger"
                                type="button"
                                disabled={actionLoading}
                                onClick={handleDeleteConfirm}
                                >
                                    {actionLoading ? ('Eliminando...') : ('Eliminar proveedor')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}
export default Proveedores;