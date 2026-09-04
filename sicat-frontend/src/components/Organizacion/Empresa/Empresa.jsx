// src/components/Empresa/VerEmpresa/VerEmpresa.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import client from '../../../api/client';
import Layout from '../../layout/Layout';
import './Empresa.css';

function VerEmpresa() {
    const { usuario } = useAuth();

    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Search and filter
    const [search, setSearch] = useState('');
    const [filterEstado, setFilterEstado] = useState('ALL');

    // Modal state for Create / Edit
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
    const [currentEmpresa, setCurrentEmpresa] = useState(null);

    // Form inputs
    const [nombre, setNombre] = useState('');
    const [rfc, setRfc] = useState('');
    const [direccion, setDireccion] = useState('');
    const [activa, setActiva] = useState(true);

    // Delete confirmation modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [empresaToDelete, setEmpresaToDelete] = useState(null);

    useEffect(() => {
        fetchEmpresas();
    }, []);

    const fetchEmpresas = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await client.get('/empresas');
            setEmpresas(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cargar las empresas');
        } finally {
            setLoading(false);
        }
    };

    // Open modal to create
    const handleOpenCreate = () => {
        setModalMode('CREATE');
        setCurrentEmpresa(null);
        setNombre('');
        setRfc('');
        setDireccion('');
        setActiva(true);
        setError('');
        setModalOpen(true);
    };

    // Open modal to edit
    const handleOpenEdit = (empresa) => {
        setModalMode('EDIT');
        setCurrentEmpresa(empresa);
        setNombre(empresa.nombre || '');
        setRfc(empresa.rfc || '');
        setDireccion(empresa.direccion || '');
        setActiva(empresa.activa ?? true);
        setError('');
        setModalOpen(true);
    };

    // Save (Create or Update)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) {
            setError('El nombre de la empresa es obligatorio.');
            return;
        }

        setActionLoading(true);
        setError('');
        setSuccess('');

        const payload = {
            nombre: nombre.trim(),
            rfc: rfc.trim().toUpperCase() || null,
            direccion: direccion.trim() || null,
            activa,
        };

        try {
            if (modalMode === 'CREATE') {
                const { data } = await client.post('/empresas', payload);
                setEmpresas((prev) => [...prev, data]);
                setSuccess('Empresa creada exitosamente.');
            } else {
                const { data } = await client.put(`/empresas/${currentEmpresa.id_empresa}`, payload);
                setEmpresas((prev) =>
                    prev.map((item) => (item.id_empresa === currentEmpresa.id_empresa ? data : item))
                );
                setSuccess('Empresa actualizada exitosamente.');
            }
            setModalOpen(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al guardar la empresa');
        } finally {
            setActionLoading(false);
        }
    };

    // Toggle active status directly
    const handleToggleStatus = async (empresa) => {
        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            const { data } = await client.put(`/empresas/${empresa.id_empresa}`, {
                nombre: empresa.nombre,
                rfc: empresa.rfc,
                direccion: empresa.direccion,
                activa: !empresa.activa,
            });
            setEmpresas((prev) =>
                prev.map((item) => (item.id_empresa === empresa.id_empresa ? data : item))
            );
            setSuccess(`Empresa ${data.activa ? 'activada' : 'desactivada'} correctamente.`);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cambiar estado');
        } finally {
            setActionLoading(false);
        }
    };

    // Open Delete confirmation
    const handleOpenDelete = (empresa) => {
        setEmpresaToDelete(empresa);
        setDeleteModalOpen(true);
    };

    // Confirm Delete
    const handleConfirmDelete = async () => {
        if (!empresaToDelete) return;
        setActionLoading(true);
        setError('');
        setSuccess('');
        try {
            await client.delete(`/empresas/${empresaToDelete.id_empresa}`);
            setEmpresas((prev) => prev.filter((item) => item.id_empresa !== empresaToDelete.id_empresa));
            setSuccess('Empresa eliminada exitosamente.');
            setDeleteModalOpen(false);
            setEmpresaToDelete(null);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al eliminar la empresa. Podría tener departamentos asignados.');
        } finally {
            setActionLoading(false);
        }
    };

    // Filtered list
    const empresasFiltradas = useMemo(() => {
        return empresas.filter((emp) => {
            const matchSearch =
                (emp.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
                (emp.rfc || '').toLowerCase().includes(search.toLowerCase()) ||
                (emp.direccion || '').toLowerCase().includes(search.toLowerCase());

            if (!matchSearch) return false;
            if (filterEstado === 'ACTIVE') return emp.activa === true;
            if (filterEstado === 'INACTIVE') return emp.activa === false;
            return true;
        });
    }, [empresas, search, filterEstado]);

    // metricas
    const totalCount = empresas.length;
    const activasCount = empresas.filter((e) => e.activa).length;
    const inactivasCount = totalCount - activasCount;

    return (
        <Layout>
            <div className="empresa-container">
                {/* ── Header ── */}
                <div className="empresa-header">
                    <div>
                        <h1 className="empresa-header__title">Gestión de Empresas</h1>
                        <p className="empresa-header__subtitle">
                            Administra las empresas y razones sociales registradas en SICAT
                        </p>
                    </div>
                    <div className="empresa-header__actions">
                        <button
                            className="empresa-btn empresa-btn--secondary"
                            onClick={fetchEmpresas}
                            disabled={loading}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={loading ? 'empresa-btn__spin' : ''}
                            >
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            <span>Actualizar</span>
                        </button>
                        {usuario?.rol === 'admin' && (
                            <button
                                className="empresa-btn empresa-btn--primary"
                                onClick={handleOpenCreate}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Nueva Empresa</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Stats ── */}
                <div className="empresa-stats">
                    <div className="empresa-stat" style={{ borderColor: '#7c3aed' }}>
                        <span className="empresa-stat__count" style={{ color: '#c4b5fd' }}>
                            {totalCount}
                        </span>
                        <span className="empresa-stat__label">Total Empresas</span>
                    </div>
                    <div className="empresa-stat" style={{ borderColor: '#10b981' }}>
                        <span className="empresa-stat__count" style={{ color: '#10b981' }}>
                            {activasCount}
                        </span>
                        <span className="empresa-stat__label">Activas</span>
                    </div>
                    <div className="empresa-stat" style={{ borderColor: '#f59e0b' }}>
                        <span className="empresa-stat__count" style={{ color: '#f59e0b' }}>
                            {inactivasCount}
                        </span>
                        <span className="empresa-stat__label">Inactivas</span>
                    </div>
                </div>

                {/* ── Alerts ── */}
                {error && (
                    <div className="empresa-alert empresa-alert--error" role="alert">
                        <div className="empresa-alert__content">
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                            <span>{error}</span>
                        </div>
                        <button
                            type="button"
                            className="empresa-alert__close"
                            onClick={() => setError('')}
                            title="Cerrar alerta"
                            aria-label="Cerrar alerta"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {success && (
                    <div className="empresa-alert empresa-alert--success" role="alert">
                        <div className="empresa-alert__content">
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <span>{success}</span>
                        </div>
                        <button
                            type="button"
                            className="empresa-alert__close"
                            onClick={() => setSuccess('')}
                            title="Cerrar notificación"
                            aria-label="Cerrar notificación"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* ── Search & Filters Toolbar ── */}
                <div className="empresa-toolbar">
                    <div className="empresa-search-wrap">
                        <span className="empresa-search-icon">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="empresa-search-input"
                            placeholder="Buscar por nombre, RFC o dirección..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="empresa-filter-select"
                        value={filterEstado}
                        onChange={(e) => setFilterEstado(e.target.value)}
                    >
                        <option value="ALL">Todos los estados</option>
                        <option value="ACTIVE">Solo Activas</option>
                        <option value="INACTIVE">Solo Inactivas</option>
                    </select>
                </div>

                {/* ── Table ── */}
                <div className="empresa-table-wrap">
                    <table className="empresa-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nombre</th>
                                <th>RFC</th>
                                <th>Dirección</th>
                                <th>Estado</th>
                                {usuario?.rol === 'admin' && <th>Acciones</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={usuario?.rol === 'admin' ? 6 : 5} className="empresa-table__empty">
                                        <span className="empresa-btn__spin" style={{ display: 'inline-block', marginRight: '8px' }}>
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <polyline points="23 4 23 10 17 10" />
                                                <polyline points="1 20 1 14 7 14" />
                                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                            </svg>
                                        </span>
                                        Cargando empresas...
                                    </td>
                                </tr>
                            ) : empresasFiltradas.length === 0 ? (
                                <tr>
                                    <td colSpan={usuario?.rol === 'admin' ? 6 : 5} className="empresa-table__empty">
                                        {search || filterEstado !== 'ALL'
                                            ? 'No se encontraron empresas con esos criterios'
                                            : 'No hay empresas registradas'}
                                    </td>
                                </tr>
                            ) : (
                                empresasFiltradas.map((empresa) => (
                                    <tr key={empresa.id_empresa}>
                                        <td className="empresa-table__id">#{empresa.id_empresa}</td>
                                        <td className="empresa-table__nombre">{empresa.nombre}</td>
                                        <td className="empresa-table__rfc">{empresa.rfc || '—'}</td>
                                        <td>{empresa.direccion || '—'}</td>
                                        <td>
                                            <span
                                                className={`empresa-badge ${empresa.activa ? 'empresa-badge--active' : 'empresa-badge--inactive'
                                                    }`}
                                            >
                                                <span className="empresa-badge__dot" />
                                                {empresa.activa ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </td>
                                        {usuario?.rol === 'admin' && (
                                            <td>
                                                <div className="empresa-table__actions">
                                                    {/* Toggle status */}
                                                    <button
                                                        type="button"
                                                        className="empresa-action-btn"
                                                        title={empresa.activa ? 'Desactivar' : 'Activar'}
                                                        onClick={() => handleToggleStatus(empresa)}
                                                        disabled={actionLoading}
                                                    >
                                                        {empresa.activa ? (
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="12" cy="12" r="10" />
                                                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                                            </svg>
                                                        ) : (
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                                <polyline points="22 4 12 14.01 9 11.01" />
                                                            </svg>
                                                        )}
                                                    </button>

                                                    {/* Edit */}
                                                    <button
                                                        type="button"
                                                        className="empresa-action-btn empresa-action-btn--edit"
                                                        title="Editar empresa"
                                                        onClick={() => handleOpenEdit(empresa)}
                                                        disabled={actionLoading}
                                                    >
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        type="button"
                                                        className="empresa-action-btn empresa-action-btn--delete"
                                                        title="Eliminar empresa"
                                                        onClick={() => handleOpenDelete(empresa)}
                                                        disabled={actionLoading}
                                                    >
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Modal: Create / Edit ── */}
                {modalOpen && (
                    <div className="empresa-modal-overlay">
                        <div className="empresa-modal">
                            <div className="empresa-modal__header">
                                <h2 className="empresa-modal__title">
                                    {modalMode === 'CREATE' ? 'Nueva Empresa' : 'Editar Empresa'}
                                </h2>
                                <button
                                    type="button"
                                    className="empresa-modal__close"
                                    onClick={() => setModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="empresa-form-group">
                                    <label className="empresa-form-label">Nombre de la Empresa</label>
                                    <input
                                        type="text"
                                        className="empresa-form-input"
                                        placeholder="Ej. Industrias ABC, S.A. de C.V."
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="empresa-form-group">
                                    <label className="empresa-form-label">RFC</label>
                                    <input
                                        type="text"
                                        className="empresa-form-input"
                                        placeholder="Ej. ABC123456T12"
                                        value={rfc}
                                        onChange={(e) => setRfc(e.target.value.toUpperCase())}
                                        maxLength={13}
                                        required
                                    />
                                </div>

                                <div className="empresa-form-group">
                                    <label className="empresa-form-label">Dirección (Opcional)</label>
                                    <textarea
                                        className="empresa-form-textarea"
                                        placeholder="Calle, Número, Colonia, Ciudad..."
                                        value={direccion}
                                        onChange={(e) => setDireccion(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="empresa-form-group">
                                    <label className="empresa-form-checkbox-label">
                                        <input
                                            type="checkbox"
                                            className="empresa-form-checkbox"
                                            checked={activa}
                                            onChange={(e) => setActiva(e.target.checked)}
                                        />
                                        <span>Empresa Activa</span>
                                        <span>Se requieren todos los campos llenos</span>
                                    </label>
                                </div>

                                <div className="empresa-modal__footer">
                                    <button
                                        type="button"
                                        className="empresa-btn empresa-btn--secondary"
                                        onClick={() => setModalOpen(false)}
                                        disabled={actionLoading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="empresa-btn empresa-btn--primary"
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? (
                                            <>
                                                <span className="empresa-btn__spin">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="23 4 23 10 17 10" />
                                                        <polyline points="1 20 1 14 7 14" />
                                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                                    </svg>
                                                </span>
                                                <span>Guardando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                                    <polyline points="17 21 17 13 7 13 7 21" />
                                                    <polyline points="7 3 7 8 15 8" />
                                                </svg>
                                                <span>{modalMode === 'CREATE' ? 'Crear Empresa' : 'Guardar Cambios'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Modal: Delete Confirmation ── */}
                {deleteModalOpen && empresaToDelete && (
                    <div className="empresa-modal-overlay">
                        <div className="empresa-modal" style={{ maxWidth: '420px' }}>
                            <div className="empresa-modal__header">
                                <h2 className="empresa-modal__title" style={{ color: '#fca5a5' }}>
                                    Confirmar Eliminación
                                </h2>
                                <button
                                    type="button"
                                    className="empresa-modal__close"
                                    onClick={() => setDeleteModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: '1.5', margin: '0.5rem 0 1.5rem' }}>
                                ¿Estás seguro de que deseas eliminar la empresa{' '}
                                <strong style={{ color: '#f1f5f9' }}>{empresaToDelete.nombre}</strong>? Esta acción no se puede deshacer.
                            </p>
                            <div className="empresa-modal__footer">
                                <button
                                    type="button"
                                    className="empresa-btn empresa-btn--secondary"
                                    onClick={() => setDeleteModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="empresa-btn empresa-btn--danger"
                                    onClick={handleConfirmDelete}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? (
                                        <>
                                            <span className="empresa-btn__spin">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="23 4 23 10 17 10" />
                                                    <polyline points="1 20 1 14 7 14" />
                                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                                </svg>
                                            </span>
                                            <span>Eliminando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                            <span>Sí, Eliminar</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

export default VerEmpresa;