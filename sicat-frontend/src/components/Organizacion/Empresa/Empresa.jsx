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
            setError('Error al eliminar la empresa. Revisa si no tiene departamentos asignados.' || err.response?.data?.error);
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
    const empresasTotal = empresas.length;
    const activasTotal = empresas.filter((e)=> e.activa).length;
    const inactivasTotal = empresas.filter((e)=> !e.activas).length;
    

    return (
        <Layout>
            <div className="empresa-container">
                <div className="empresa-header">
                    <div>
                        <h1 className="empresa-header__title">Gestión de Empresas</h1>
                        <p className="empresa-header__subtitle">
                            Administra las empresas registradas o registra nuevas.
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
                
                <div className="empresa-kpis">
                    <div className="empresa-kpi" onClick={()=> setFilterEstado('ALL')}>
                        <div className="prov-kpi__icon-box prov-kpi__icon-box--cyan">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                                <g id="SVGRepo_iconCarrier">
                                    <path d="M18 21V22C18.5523 22 19 21.5523 19 21H18ZM6 21H5C5 21.5523 5.44772 22 6 22V21ZM17.454 3.10899L17 4L17.454 3.10899ZM17.891 3.54601L17 4L17.891 3.54601ZM6.54601 3.10899L7 4L6.54601 3.10899ZM6.10899 3.54601L7 4L6.10899 3.54601ZM9 6C8.44772 6 8 6.44772 8 7C8 7.55228 8.44772 8 9 8V6ZM10 8C10.5523 8 11 7.55228 11 7C11 6.44772 10.5523 6 10 6V8ZM9 9C8.44772 9 8 9.44772 8 10C8 10.5523 8.44772 11 9 11V9ZM10 11C10.5523 11 11 10.5523 11 10C11 9.44772 10.5523 9 10 9V11ZM14 9C13.4477 9 13 9.44772 13 10C13 10.5523 13.4477 11 14 11V9ZM15 11C15.5523 11 16 10.5523 16 10C16 9.44772 15.5523 9 15 9V11ZM14 12C13.4477 12 13 12.4477 13 13C13 13.5523 13.4477 14 14 14V12ZM15 14C15.5523 14 16 13.5523 16 13C16 12.4477 15.5523 12 15 12V14ZM9 12C8.44772 12 8 12.4477 8 13C8 13.5523 8.44772 14 9 14V12ZM10 14C10.5523 14 11 13.5523 11 13C11 12.4477 10.5523 12 10 12V14ZM14 6C13.4477 6 13 6.44772 13 7C13 7.55228 13.4477 8 14 8V6ZM15 8C15.5523 8 16 7.55228 16 7C16 6.44772 15.5523 6 15 6V8ZM7.6 4H16.4V2H7.6V4ZM17 4.6V21H19V4.6H17ZM18 20H6V22H18V20ZM7 21V4.6H5V21H7ZM16.4 4C16.6965 4 16.8588 4.00078 16.9754 4.0103C17.0803 4.01887 17.0575 4.0293 17 4L17.908 2.21799C17.6366 2.07969 17.3668 2.03562 17.1382 2.01695C16.9213 1.99922 16.6635 2 16.4 2V4ZM19 4.6C19 4.33647 19.0008 4.07869 18.9831 3.86177C18.9644 3.63318 18.9203 3.36344 18.782 3.09202L17 4C16.9707 3.94249 16.9811 3.91972 16.9897 4.02463C16.9992 4.14122 17 4.30347 17 4.6H19ZM17 4L18.782 3.09202C18.5903 2.7157 18.2843 2.40973 17.908 2.21799L17 4ZM7.6 2C7.33647 2 7.07869 1.99922 6.86177 2.01695C6.63318 2.03562 6.36344 2.07969 6.09202 2.21799L7 4C6.94249 4.0293 6.91972 4.01887 7.02463 4.0103C7.14122 4.00078 7.30347 4 7.6 4V2ZM7 4.6C7 4.30347 7.00078 4.14122 7.0103 4.02463C7.01887 3.91972 7.0293 3.94249 7 4L5.21799 3.09202C5.07969 3.36344 5.03562 3.63318 5.01695 3.86177C4.99922 4.07869 5 4.33647 5 4.6H7ZM6.09202 2.21799C5.71569 2.40973 5.40973 2.71569 5.21799 3.09202L7 4L6.09202 2.21799ZM9 8H10V6H9V8ZM9 11H10V9H9V11ZM14 11H15V9H14V11ZM14 14H15V12H14V14ZM9 14H10V12H9V14ZM14 8H15V6H14V8ZM13 18V21H15V18H13ZM11 21V18H9V21H11ZM12 17C12.5523 17 13 17.4477 13 18H15C15 16.3431 13.6569 15 12 15V17ZM12 15C10.3431 15 9 16.3431 9 18H11C11 17.4477 11.4477 17 12 17V15Z" fill="currentColor"></path>
                                </g>
                            </svg>
                        </div>
                        <div className="prov-kpi__content">
                            <div className="prov-kpi__label">Total de empresas</div>
                            <div className="prov-kpi__value">
                                {empresasTotal}
                            </div>
                        </div>
                    </div>
                    
                    <div className="empresa-kpi" onClick={()=> setFilterEstado('ACTIVE')}>
                        <div className="prov-kpi__icon-box prov-kpi__icon-box--emerald">
                            <svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                                <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                                <g id="SVGRepo_iconCarrier">
                                    <path d="M7 7H8M7 10H8M12 10H13M12 13H13M7 13H8M12 7H13M8 21V18C8 16.8954 8.89543 16 10 16C10.5973 16 11.1335 16.2619 11.5 16.6771M16 15V4.6C16 4.03995 16 3.75992 15.891 3.54601C15.7951 3.35785 15.6422 3.20487 15.454 3.10899C15.2401 3 14.9601 3 14.4 3H5.6C5.03995 3 4.75992 3 4.54601 3.10899C4.35785 3.20487 4.20487 3.35785 4.10899 3.54601C4 3.75992 4 4.03995 4 4.6V21H11.5M15 19L17 21L21 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                </g>
                            </svg>
                        </div>
                        <div className="prov-kpi__content">
                            <div className="prov-kpi__label">Empresas Activas</div>
                            <div className="prov-kpi__value">
                                {activasTotal}
                            </div>
                        </div>
                    </div>
                    <div className="empresa-kpi" onClick={()=> setFilterEstado('INACTIVE')}>
                        <div className="prov-kpi__icon-box prov-kpi__icon-box--amber">
                            <svg width="22px" height="22px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                                <g id="SVGRepo_iconCarrier">
                                    <path d="M12 21H11M11 21H7M11 21V18C11 16.8954 10.1046 16 9 16C7.89543 16 7 16.8954 7 18V21M7 21H3V4.6C3 4.03995 3 3.75992 3.10899 3.54601C3.20487 3.35785 3.35785 3.20487 3.54601 3.10899C3.75992 3 4.03995 3 4.6 3H13.4C13.9601 3 14.2401 3 14.454 3.10899C14.6422 3.20487 14.7951 3.35785 14.891 3.54601C15 3.75992 15 4.03995 15 4.6V12M6 7H7M6 10H7M11 10H12M11 13H12M6 13H7M11 7H12M16 16L18.5 18.5M18.5 18.5L21 21M18.5 18.5L21 16M18.5 18.5L16 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                                </g>
                            </svg>
                        </div>
                        <div className="prov-kpi__content">
                            <div className="prov-kpi__label">Empresas Inactivas</div>
                            <div className="prov-kpi__value">
                                {inactivasTotal}
                            </div>
                        </div>
                    </div>
                </div>

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
                                                    onClick={()=> setFilterEstado(empresa.activa ? 'ACTIVE' : 'INACTIVE')}
                                            >
                                                <span className="empresa-badge__dot"/>
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
                            {error && (
                                    <div className="empresa-alert empresa-alert--error" role="alert" style={{ marginTop: '0.5rem' }}>
                                        <div className="empresa-alert__content">
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
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                            <span>{error}</span>
                                        </div>
                                    </div>
                                )}
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