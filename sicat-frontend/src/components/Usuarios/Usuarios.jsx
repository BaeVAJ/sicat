// src/components/Usuarios/Usuarios.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import './Usuarios.css';

function Usuarios() {
    const { usuario: currentUser } = useAuth();

    const [usuarios, setUsuarios] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [search, setSearch] = useState('');
    const [filterRol, setFilterRol] = useState('ALL');
    const [filterDepartamento, setFilterDepartamento] = useState('ALL');
    const [filterEstatus, setFilterEstatus] = useState('ALL');
    const [viewMode, setViewMode] = useState('TABLE'); // 'TABLE' | 'GRID'

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
    const [selectedUser, setSelectedUser] = useState(null);

    const [nombre, setNombre] = useState('');
    const [correo, setCorreo] = useState('');
    const [rol, setRol] = useState('usuario');
    const [idDepartamento, setIdDepartamento] = useState('');
    const [estatusEmpleado, setEstatusEmpleado] = useState('activo');
    const [contrasena, setContrasena] = useState('');
    const [confirmarContrasena, setConfirmarContrasena] = useState('');
    const [mostrarContrasena, setMostrarContrasena] = useState(false);
    const [formError, setFormError] = useState('');

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    const [detailUser, setDetailUser] = useState(null);
    const [isMobile, setIsMobile] = useState(false);

    // ¿El usuario que estoy editando soy yo mismo?
    const isEditingSelf =
        modalMode === 'EDIT' &&
        selectedUser &&
        currentUser &&
        selectedUser.id_usuario === currentUser.id_usuario;

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [usersRes, deptRes, empRes] = await Promise.all([
                client.get('/usuarios'),
                client.get('/departamentos').catch(() => ({ data: [] })),
                client.get('/empresas').catch(() => ({ data: [] }))
            ]);

            setUsuarios(Array.isArray(usersRes.data) ? usersRes.data : []);
            setDepartamentos(Array.isArray(deptRes.data) ? deptRes.data : []);
            setEmpresas(Array.isArray(empRes.data) ? empRes.data : []);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al obtener la lista de usuarios');
        } finally {
            setLoading(false);
        }
    };

    const empresaMap = useMemo(() => {
        const map = {};
        empresas.forEach(e => {
            map[e.id_empresa] = e.nombre;
        });
        return map;
    }, [empresas]);

    const departamentoMap = useMemo(() => {
        const map = {};
        departamentos.forEach(d => {
            map[d.id_departamento] = {
                ...d,
                empresa_nombre: empresaMap[d.id_empresa] || ''
            };
        });
        return map;
    }, [departamentos, empresaMap]);

    // Métricas en tiempo real para las tarjetas KPI
    const stats = useMemo(() => {
        const total = usuarios.length;
        const inactivos = usuarios.filter(u => (u.estatus_empleado || 'inactivo') === 'inactivo').length;
        const suspendidos = usuarios.filter(u => (u.estatus_empleado || 'suspendido') === 'suspendido').length;
        const activos = usuarios.filter(u => (u.estatus_empleado || 'activo') === 'activo').length;
        return { total, inactivos, suspendidos, activos };
    }, [usuarios]);

    const handleOpenCreate = () => {
        setModalMode('CREATE');
        setSelectedUser(null);
        setNombre('');
        setCorreo('');
        setRol('usuario');
        setIdDepartamento('');
        setEstatusEmpleado('activo');
        setContrasena('');
        setConfirmarContrasena('');
        setMostrarContrasena(false);
        setFormError('');
        setModalOpen(true);
    };

    const handleOpenEdit = (user) => {
        if (user.estatus_empleado === 'suspendido') {
            setError(`El usuario "${user.nombre}" está suspendido y no puede editarse.`);
            return;
        }
        setModalMode('EDIT');
        setSelectedUser(user);
        setNombre(user.nombre || '');
        setCorreo(user.correo || '');
        setRol(user.rol || 'usuario');
        setIdDepartamento(user.id_departamento ? String(user.id_departamento) : '');
        setEstatusEmpleado(user.estatus_empleado || 'activo');
        setContrasena('');
        setConfirmarContrasena('');
        setMostrarContrasena(false);
        setFormError('');
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!nombre.trim()) {
            setFormError('El nombre completo es obligatorio.');
            return;
        }

        if (!correo.trim()) {
            setFormError('El correo electrónico es obligatorio.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo.trim())) {
            setFormError('Ingresa un formato de correo electrónico válido.');
            return;
        }

        if (modalMode === 'CREATE') {
            if (!contrasena) {
                setFormError('La contraseña inicial es obligatoria.');
                return;
            }
            if (contrasena.length < 6) {
                setFormError('La contraseña debe contener al menos 6 caracteres.');
                return;
            }
            if (contrasena !== confirmarContrasena) {
                setFormError('Las contraseñas no coinciden.');
                return;
            }
        } else if (modalMode === 'EDIT' && contrasena) {
            if (contrasena.length < 6) {
                setFormError('La nueva contraseña debe contener al menos 6 caracteres.');
                return;
            }
            if (contrasena !== confirmarContrasena) {
                setFormError('Las contraseñas no coinciden.');
                return;
            }
        }

        setActionLoading(true);

        const payload = {
            nombre: nombre.trim(),
            correo: correo.trim().toLowerCase(),
            rol,
            id_departamento: idDepartamento ? Number(idDepartamento) : null,
        };

        if (modalMode === 'EDIT' && !isEditingSelf) {
            payload.estatus_empleado = estatusEmpleado;
        }

        if (contrasena) {
            payload.contrasena = contrasena;
        }

        try {
            if (modalMode === 'CREATE') {
                const { data } = await client.post('/usuarios', payload);
                setUsuarios((prev) => [data, ...prev]);
                setSuccess(`Usuario "${data.nombre}" creado exitosamente.`);
            } else {
                const { data } = await client.put(`/usuarios/${selectedUser.id_usuario}`, payload);
                setUsuarios((prev) =>
                    prev.map((u) => (u.id_usuario === selectedUser.id_usuario ? data : u))
                );
                setSuccess(`Usuario "${data.nombre}" actualizado correctamente.`);
            }
            setModalOpen(false);
        } catch (err) {
            setFormError(err.response?.data?.error || 'Error al procesar la solicitud.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenDelete = (user) => {
        setUserToDelete(user);
        setDeleteModalOpen(true);
    };

    const handleOpenDetail = (user) => {
        setDetailUser(user);
    };

    const handleConfirmDelete = async () => {
        if (!userToDelete) return;
        setActionLoading(true);
        setError('');

        try {
            await client.delete(`/usuarios/${userToDelete.id_usuario}`);
            setUsuarios((prev) => prev.filter((u) => u.id_usuario !== userToDelete.id_usuario));
            setSuccess(`Usuario "${userToDelete.nombre}" eliminado exitosamente.`);
            setDeleteModalOpen(false);
            setUserToDelete(null);
        } catch (err) {
            const status = err.response?.status;
            const msg = err.response?.data?.error || '';

            const bloqueoPorIntegridad =
                status === 409 &&
                /tickets|asignaciones|registros|integridad|asociad/i.test(msg);

            if (bloqueoPorIntegridad) {
                try {
                    const { data } = await client.put(
                        `/usuarios/${userToDelete.id_usuario}`,
                        {
                            nombre: userToDelete.nombre,
                            correo: userToDelete.correo,
                            rol: userToDelete.rol,
                            id_departamento: userToDelete.id_departamento,
                            estatus_empleado: 'suspendido',
                        }
                    );
                    setUsuarios((prev) =>
                        prev.map((u) => (u.id_usuario === data.id_usuario ? data : u))
                    );
                    setSuccess(
                        `El usuario "${data.nombre}" tiene registros asociados y no puede eliminarse. Se cambió su estatus a "Suspendido".`
                    );
                    setDeleteModalOpen(false);
                    setUserToDelete(null);
                } catch (putErr) {
                    setError(
                        putErr.response?.data?.error ||
                        'No se pudo eliminar ni suspender el usuario.'
                    );
                    setDeleteModalOpen(false);
                }
            } else {
                setError(msg || 'Error al eliminar el usuario.');
                setDeleteModalOpen(false);
            }
        } finally {
            setActionLoading(false);
        }
    };

    const usuariosFiltrados = useMemo(() => {
        return usuarios.filter((u) => {
            const matchSearch =
                (u.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
                (u.correo || '').toLowerCase().includes(search.toLowerCase()) ||
                (u.departamento_nombre || '').toLowerCase().includes(search.toLowerCase()) ||
                (u.empresa_nombre || '').toLowerCase().includes(search.toLowerCase()) ||
                (u.rol || '').toLowerCase().includes(search.toLowerCase());

            if (!matchSearch) return false;

            if (filterRol !== 'ALL' && u.rol !== filterRol) {
                return false;
            }

            if (filterEstatus !== 'ALL') {
                const estatus = u.estatus_empleado || 'activo';
                if (estatus !== filterEstatus) return false;
            }

            if (filterDepartamento !== 'ALL') {
                if (filterDepartamento === 'NONE') {
                    if (u.id_departamento) return false;
                } else if (String(u.id_departamento) !== filterDepartamento) {
                    return false;
                }
            }

            return true;
        });
    }, [usuarios, search, filterRol, filterDepartamento, filterEstatus]);

    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const getRoleBadge = (rolName) => {
        switch (rolName) {
            case 'admin':
                return {
                    label: 'Administrador',
                    className: 'usr-badge--admin',
                    icon: (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                    )
                };
            case 'gerente':
                return {
                    label: 'Gerente',
                    className: 'usr-badge--gerente',
                    icon: (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    )
                };
            default:
                return {
                    label: 'Usuario',
                    className: 'usr-badge--usuario',
                    icon: (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="7" r="4" />
                            <path d="M5.5 21a8.38 8.38 0 0 1 13 0" />
                        </svg>
                    )
                };
        }
    };

    const getEstatusLabel = (est) => {
        const v = est || 'activo';
        return v.charAt(0).toUpperCase() + v.slice(1);
    };

    const isAdmin = currentUser?.rol === 'admin';

    return (
        <Layout>
            <div className="usr-page">
                <header className="usr-header">
                    <div className="usr-header__info">
                        <div className="usr-header__icon-wrapper">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="usr-header__title">Administración de Usuarios</h1>
                            <p className="usr-header__subtitle">
                                Control de accesos y asignación de departamentos
                            </p>
                        </div>
                    </div>

                    <div className="usr-header__actions">
                        <button
                            type="button"
                            className="usr-btn usr-btn--secondary"
                            onClick={fetchData}
                            disabled={loading}
                            title="Recargar listado"
                        >
                            <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={loading ? 'usr-spin' : ''}
                            >
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            <span>Refrescar</span>
                        </button>

                        {isAdmin && (
                            <button
                                type="button"
                                className="usr-btn usr-btn--primary"
                                onClick={handleOpenCreate}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Nuevo Usuario</span>
                            </button>
                        )}
                    </div>
                </header>

                {/* Tarjetas de Métricas Ejecutivas */}
                {!loading && (
                    <div className="usr-stats-grid">
                        <div className="usr-stat-card">
                            <div className="usr-stat-card__icon usr-stat-card__icon--primary">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <div className="usr-stat-card__content">
                                <span className="usr-stat-card__label">Total Usuarios</span>
                                <span className="usr-stat-card__value">{stats.total}</span>
                            </div>
                        </div>

                        <div className="usr-stat-card">
                            <div className="usr-stat-card__icon usr-stat-card__icon--admin">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                            </div>
                            <div className="usr-stat-card__content">
                                <span className="usr-stat-card__label">Usuarios Inactivos</span>
                                <span className="usr-stat-card__value">{stats.inactivos}</span>
                            </div>
                        </div>

                        <div className="usr-stat-card">
                            <div className="usr-stat-card__icon usr-stat-card__icon--gerente">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            <div className="usr-stat-card__content">
                                <span className="usr-stat-card__label">Usuarios Suspendidos</span>
                                <span className="usr-stat-card__value">{stats.suspendidos}</span>
                            </div>
                        </div>

                        <div className="usr-stat-card">
                            <div className="usr-stat-card__icon usr-stat-card__icon--dept">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                            <div className="usr-stat-card__content">
                                <span className="usr-stat-card__label">Usuarios Activos</span>
                                <span className="usr-stat-card__value">{stats.activos}</span>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="usr-alert usr-alert--danger">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{error}</span>
                        <button type="button" className="usr-alert__close" onClick={() => setError('')}>&times;</button>
                    </div>
                )}

                {success && (
                    <div className="usr-alert usr-alert--success">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span>{success}</span>
                        <button type="button" className="usr-alert__close" onClick={() => setSuccess('')}>&times;</button>
                    </div>
                )}

                <div className="usr-toolbar">
                    <div className="usr-search-box">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="usr-search-icon">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, correo, rol o depto..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="usr-search-input"
                        />
                        {search && (
                            <button
                                type="button"
                                className="usr-search-clear"
                                onClick={() => setSearch('')}
                                title="Limpiar búsqueda"
                            >
                                &times;
                            </button>
                        )}
                    </div>

                    <div className="usr-filters">
                        <div className="usr-select-wrapper">
                            <select
                                value={filterRol}
                                onChange={(e) => setFilterRol(e.target.value)}
                                className="usr-select"
                            >
                                <option value="ALL">Todos los roles</option>
                                <option value="admin">Administrador</option>
                                <option value="gerente">Gerente</option>
                                <option value="usuario">Usuario Estándar</option>
                            </select>
                        </div>

                        <div className="usr-select-wrapper">
                            <select
                                value={filterEstatus}
                                onChange={(e) => setFilterEstatus(e.target.value)}
                                className="usr-select"
                            >
                                <option value="ALL">Todos los estatus</option>
                                <option value="activo">Activo</option>
                                <option value="inactivo">Inactivo</option>
                                <option value="suspendido">Suspendido</option>
                            </select>
                        </div>

                        <div className="usr-select-wrapper">
                            <select
                                value={filterDepartamento}
                                onChange={(e) => setFilterDepartamento(e.target.value)}
                                className="usr-select"
                            >
                                <option value="ALL">Todos los departamentos</option>
                                <option value="NONE">Sin departamento</option>
                                {departamentos.map((d) => (
                                    <option key={d.id_departamento} value={String(d.id_departamento)}>
                                        {d.nombre} {empresaMap[d.id_empresa] ? `(${empresaMap[d.id_empresa]})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="usr-view-switcher">
                            <button
                                type="button"
                                className={`usr-view-btn ${viewMode === 'TABLE' ? 'active' : ''}`}
                                onClick={() => setViewMode('TABLE')}
                                title="Vista en Tabla"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="8" y1="6" x2="21" y2="6" />
                                    <line x1="8" y1="12" x2="21" y2="12" />
                                    <line x1="8" y1="18" x2="21" y2="18" />
                                    <line x1="3" y1="6" x2="3.01" y2="6" />
                                    <line x1="3" y1="12" x2="3.01" y2="12" />
                                    <line x1="3" y1="18" x2="3.01" y2="18" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                className={`usr-view-btn ${viewMode === 'GRID' ? 'active' : ''}`}
                                onClick={() => setViewMode('GRID')}
                                title="Vista en Tarjetas"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="7" height="7" />
                                    <rect x="14" y="3" width="7" height="7" />
                                    <rect x="14" y="14" width="7" height="7" />
                                    <rect x="3" y="14" width="7" height="7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="usr-loading-state">
                        <div className="usr-spinner"></div>
                        <p>Cargando información de usuarios...</p>
                    </div>
                ) : usuariosFiltrados.length === 0 ? (
                    <div className="usr-empty-state">
                        <div className="usr-empty-state__icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <line x1="17" y1="8" x2="23" y2="14" />
                                <line x1="23" y1="8" x2="17" y2="14" />
                            </svg>
                        </div>
                        <h3>No se encontraron usuarios</h3>
                        <p>
                            {search || filterRol !== 'ALL' || filterDepartamento !== 'ALL' || filterEstatus !== 'ALL'
                                ? 'No hay resultados que coincidan con los filtros aplicados.'
                                : 'Actualmente no hay usuarios registrados en el sistema.'}
                        </p>
                        {(search || filterRol !== 'ALL' || filterDepartamento !== 'ALL' || filterEstatus !== 'ALL') && (
                            <button
                                type="button"
                                className="usr-btn usr-btn--secondary"
                                onClick={() => {
                                    setSearch('');
                                    setFilterRol('ALL');
                                    setFilterDepartamento('ALL');
                                    setFilterEstatus('ALL');
                                }}
                            >
                                Restablecer Filtros
                            </button>
                        )}
                    </div>
                ) : viewMode === 'TABLE' ? (
                    <div className="usr-table-container">
                        <table className="usr-table">
                            <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Rol</th>
                                    <th>Estatus</th>
                                    {!isMobile && <th>Departamento / Empresa</th>}
                                    {!isMobile && <th>ID</th>}
                                    <th className="usr-table__text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuariosFiltrados.map((u) => {
                                    const badge = getRoleBadge(u.rol);
                                    const isSelf = currentUser?.id_usuario === u.id_usuario;
                                    const isSuspended = u.estatus_empleado === 'suspendido';
                                    const deptoInfo = u.id_departamento ? departamentoMap[u.id_departamento] : null;
                                    const deptoNombre = u.departamento_nombre || deptoInfo?.nombre;
                                    const empresaNombre = u.empresa_nombre || deptoInfo?.empresa_nombre;
                                    const estatus = u.estatus_empleado || 'activo';

                                    return (
                                        <tr key={u.id_usuario} className={isSelf ? 'usr-table__row--self' : ''}>
                                            <td>
                                                <div className="usr-cell-profile">
                                                    <div className={`usr-avatar usr-avatar--${u.rol}`}>
                                                        {getInitials(u.nombre)}
                                                    </div>
                                                    <div className="usr-cell-profile__info">
                                                        <span className="usr-cell-profile__name">
                                                            {u.nombre}
                                                            {isSelf && <span className="usr-self-pill">Tú</span>}
                                                        </span>
                                                        <span className="usr-cell-profile__email">{u.correo}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`usr-badge ${badge.className}`}>
                                                    {badge.icon}
                                                    <span>{badge.label}</span>
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`usr-status usr-status--${estatus}`}>
                                                    {getEstatusLabel(estatus)}
                                                </span>
                                            </td>
                                            {!isMobile && (
                                                <td>
                                                    {deptoNombre ? (
                                                        <div className="usr-depto-tag">
                                                            <span className="usr-depto-tag__name">{deptoNombre}</span>
                                                            {empresaNombre && (
                                                                <span className="usr-depto-tag__company">
                                                                    {empresaNombre}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="usr-depto-empty">Sin departamento</span>
                                                    )}
                                                </td>
                                            )}
                                            {!isMobile && (
                                                <td>
                                                    <span className="usr-id-code">#{u.id_usuario}</span>
                                                </td>
                                            )}
                                            <td className="usr-table__text-right">
                                                <div className="usr-row-actions">
                                                    {isMobile && (
                                                        <button
                                                            type="button"
                                                            className="usr-action-btn usr-action-btn--view"
                                                            onClick={() => handleOpenDetail(u)}
                                                            title="Ver detalles"
                                                        >
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                <circle cx="12" cy="12" r="3" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    {isAdmin ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="usr-action-btn usr-action-btn--edit"
                                                                onClick={() => handleOpenEdit(u)}
                                                                disabled={isSuspended}
                                                                title={
                                                                    isSuspended
                                                                        ? 'El usuario está suspendido y no puede editarse'
                                                                        : 'Editar usuario'
                                                                }
                                                            >
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="usr-action-btn usr-action-btn--delete"
                                                                onClick={() => handleOpenDelete(u)}
                                                                disabled={isSelf || isSuspended}
                                                                title={isSelf ? 'No puedes eliminar tu propia cuenta' : isSuspended ? 'El usuario está suspendido y no puede eliminarse' : 'Eliminar usuario'}
                                                            >
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <polyline points="3 6 5 6 21 6" />
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                    <line x1="10" y1="11" x2="10" y2="17" />
                                                                    <line x1="14" y1="11" x2="14" y2="17" />
                                                                </svg>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="usr-no-actions">Solo lectura</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="usr-cards-grid">
                        {usuariosFiltrados.map((u) => {
                            const badge = getRoleBadge(u.rol);
                            const isSelf = currentUser?.id_usuario === u.id_usuario;
                            const isSuspended = u.estatus_empleado === 'suspendido';
                            const deptoInfo = u.id_departamento ? departamentoMap[u.id_departamento] : null;
                            const deptoNombre = u.departamento_nombre || deptoInfo?.nombre;
                            const empresaNombre = u.empresa_nombre || deptoInfo?.empresa_nombre;
                            const estatus = u.estatus_empleado || 'activo';

                            return (
                                <div key={u.id_usuario} className={`usr-card ${isSelf ? 'usr-card--self' : ''}`}>
                                    <div className="usr-card__header">
                                        <div className={`usr-avatar usr-avatar--lg usr-avatar--${u.rol}`}>
                                            {getInitials(u.nombre)}
                                        </div>
                                        <div className="usr-card__badges">
                                            <span className={`usr-badge ${badge.className}`}>
                                                {badge.icon}
                                                <span>{badge.label}</span>
                                            </span>
                                            <span className={`usr-status usr-status--${estatus}`}>
                                                {getEstatusLabel(estatus)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="usr-card__body">
                                        <div className="usr-card__title-row">
                                            <h3 className="usr-card__name">{u.nombre}</h3>
                                            {isSelf && <span className="usr-self-pill">Tú</span>}
                                        </div>
                                        <p className="usr-card__email">{u.correo}</p>

                                        <div className="usr-card__meta">
                                            <div className="usr-card__meta-item">
                                                <span className="usr-card__meta-label">Departamento</span>
                                                <span className="usr-card__meta-val">
                                                    {deptoNombre || 'No asignado'}
                                                </span>
                                            </div>
                                            {empresaNombre && (
                                                <div className="usr-card__meta-item">
                                                    <span className="usr-card__meta-label">Empresa</span>
                                                    <span className="usr-card__meta-val">{empresaNombre}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="usr-card__footer">
                                        <span className="usr-id-code">ID #{u.id_usuario}</span>
                                        {isAdmin && (
                                            <div className="usr-card__actions">
                                                <button
                                                    type="button"
                                                    className="usr-card-btn usr-card-btn--edit"
                                                    onClick={() => handleOpenEdit(u)}
                                                    disabled={isSuspended}
                                                    title={
                                                        isSuspended
                                                            ? 'El usuario está suspendido y no puede editarse'
                                                            : 'Editar usuario'
                                                    }
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                    <span>Editar</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="usr-card-btn usr-card-btn--delete"
                                                    onClick={() => handleOpenDelete(u)}
                                                    disabled={isSelf || isSuspended}
                                                    title={isSelf ? 'No puedes eliminar tu cuenta' : 'Eliminar usuario'}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Modal Crear / Editar */}
                {modalOpen && (
                    <div className="usr-modal-backdrop" onClick={() => !actionLoading && setModalOpen(false)}>
                        <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="usr-modal__header">
                                <div className="usr-modal__header-icon">
                                    {modalMode === 'CREATE' ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                            <circle cx="9" cy="7" r="4" />
                                            <line x1="19" y1="8" x2="19" y2="14" />
                                            <line x1="22" y1="11" x2="16" y2="11" />
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <h2 className="usr-modal__title">
                                        {modalMode === 'CREATE' ? 'Crear Nuevo Usuario' : 'Editar Usuario'}
                                    </h2>
                                    <p className="usr-modal__subtitle">
                                        {modalMode === 'CREATE'
                                            ? 'Completa los datos para dar de alta una nueva cuenta en SICAT'
                                            : `Actualizando los datos de: ${selectedUser?.nombre}`}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="usr-modal__close-btn"
                                    onClick={() => setModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    &times;
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="usr-form">
                                {formError && (
                                    <div className="usr-form__alert">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="8" x2="12" y2="12" />
                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        <span>{formError}</span>
                                    </div>
                                )}

                                <div className="usr-form__grid">
                                    <div className="usr-form__group usr-form__group--full">
                                        <label htmlFor="usr-name">Nombre Completo *</label>
                                        <input
                                            id="usr-name"
                                            type="text"
                                            placeholder="Ej. Juan Pérez Gómez"
                                            value={nombre}
                                            onChange={(e) => setNombre(e.target.value)}
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    <div className="usr-form__group">
                                        <label htmlFor="usr-email">Correo Electrónico *</label>
                                        <input
                                            id="usr-email"
                                            type="email"
                                            placeholder="usuario@empresa.com"
                                            value={correo}
                                            onChange={(e) => setCorreo(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="usr-form__group">
                                        <label htmlFor="usr-role">Rol de Seguridad *</label>
                                        <select
                                            id="usr-role"
                                            value={rol}
                                            onChange={(e) => setRol(e.target.value)}
                                            required
                                        >
                                            <option value="usuario">Usuario Estándar</option>
                                            <option value="gerente">Gerente</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </div>

                                    <div className="usr-form__group usr-form__group--full">
                                        <label htmlFor="usr-dept">Departamento Asignado</label>
                                        <select
                                            id="usr-dept"
                                            value={idDepartamento}
                                            onChange={(e) => setIdDepartamento(e.target.value)}
                                        >
                                            <option value="">-- Sin Departamento Asignado --</option>
                                            {departamentos.map((d) => (
                                                <option key={d.id_departamento} value={String(d.id_departamento)}>
                                                    {d.nombre} {empresaMap[d.id_empresa] ? `(${empresaMap[d.id_empresa]})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {modalMode === 'EDIT' && (
                                        <div className="usr-form__group usr-form__group--full">
                                            <label htmlFor="usr-estatus">
                                                Estatus del Empleado *
                                                {isEditingSelf && (
                                                    <span className="usr-form__hint">
                                                        {' '}(no puedes cambiar tu propio estatus)
                                                    </span>
                                                )}
                                            </label>
                                            <select
                                                id="usr-estatus"
                                                value={estatusEmpleado}
                                                onChange={(e) => setEstatusEmpleado(e.target.value)}
                                                disabled={isEditingSelf}
                                                title={
                                                    isEditingSelf
                                                        ? 'No puedes cambiar tu propio estatus'
                                                        : ''
                                                }
                                                required
                                            >
                                                <option value="activo">Activo</option>
                                                <option value="inactivo">Inactivo</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="usr-form__group">
                                        <label htmlFor="usr-pass">
                                            {modalMode === 'CREATE' ? 'Contraseña Inicial *' : 'Nueva Contraseña (Opcional)'}
                                        </label>
                                        <div className="usr-pass-wrapper">
                                            <input
                                                id="usr-pass"
                                                type={mostrarContrasena ? 'text' : 'password'}
                                                placeholder={
                                                    modalMode === 'CREATE'
                                                        ? 'Mínimo 6 caracteres'
                                                        : 'Dejar en blanco para mantener'
                                                }
                                                value={contrasena}
                                                onChange={(e) => setContrasena(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="usr-pass-toggle"
                                                onClick={() => setMostrarContrasena(!mostrarContrasena)}
                                                tabIndex="-1"
                                                title={mostrarContrasena ? 'Ocultar' : 'Mostrar'}
                                            >
                                                {mostrarContrasena ? (
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                        <line x1="1" y1="1" x2="23" y2="23" />
                                                    </svg>
                                                ) : (
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                        <circle cx="12" cy="12" r="3" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="usr-form__group">
                                        <label htmlFor="usr-pass-confirm">Confirmar Contraseña</label>
                                        <div className="usr-pass-wrapper">
                                            <input
                                                id="usr-pass-confirm"
                                                type={mostrarContrasena ? 'text' : 'password'}
                                                placeholder="Repetir contraseña"
                                                value={confirmarContrasena}
                                                onChange={(e) => setConfirmarContrasena(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="usr-modal__footer">
                                    <button
                                        type="button"
                                        className="usr-btn usr-btn--secondary"
                                        onClick={() => setModalOpen(false)}
                                        disabled={actionLoading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="usr-btn usr-btn--primary"
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? (
                                            <>
                                                <div className="usr-spin-dot"></div>
                                                <span>Guardando...</span>
                                            </>
                                        ) : (
                                            <span>{modalMode === 'CREATE' ? 'Crear Usuario' : 'Guardar Cambios'}</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal de Detalle de Usuario */}
                {detailUser && (() => {
                    const dBadge = getRoleBadge(detailUser.rol);
                    const dDeptoInfo = detailUser.id_departamento ? departamentoMap[detailUser.id_departamento] : null;
                    const dDeptoNombre = detailUser.departamento_nombre || dDeptoInfo?.nombre;
                    const dEmpresaNombre = detailUser.empresa_nombre || dDeptoInfo?.empresa_nombre;
                    const dEstatus = detailUser.estatus_empleado || 'activo';
                    return (
                        <div className="usr-modal-backdrop" onClick={() => setDetailUser(null)}>
                            <div className="usr-modal usr-modal--sm usr-detail" onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="usr-modal__close-btn"
                                    onClick={() => setDetailUser(null)}
                                >
                                    &times;
                                </button>

                                <div className="usr-detail__top">
                                    <div className={`usr-avatar usr-avatar--lg usr-avatar--${detailUser.rol}`}>
                                        {getInitials(detailUser.nombre)}
                                    </div>
                                    <div className="usr-detail__identity">
                                        <h3 className="usr-modal__title">{detailUser.nombre}</h3>
                                        <span className={`usr-badge ${dBadge.className}`}>
                                            {dBadge.icon}
                                            <span>{dBadge.label}</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="usr-detail__list">
                                    <div className="usr-detail__item">
                                        <span className="usr-detail__label">Correo electrónico</span>
                                        <span className="usr-detail__value">{detailUser.correo}</span>
                                    </div>
                                    <div className="usr-detail__item">
                                        <span className="usr-detail__label">Estatus</span>
                                        <span className={`usr-status usr-status--${dEstatus}`}>
                                            {getEstatusLabel(dEstatus)}
                                        </span>
                                    </div>
                                    <div className="usr-detail__item">
                                        <span className="usr-detail__label">Departamento</span>
                                        <span className="usr-detail__value">{dDeptoNombre || 'No asignado'}</span>
                                    </div>
                                    <div className="usr-detail__item">
                                        <span className="usr-detail__label">Empresa</span>
                                        <span className="usr-detail__value">{dEmpresaNombre || 'No asignada'}</span>
                                    </div>
                                    <div className="usr-detail__item">
                                        <span className="usr-detail__label">ID de usuario</span>
                                        <span className="usr-id-code">#{detailUser.id_usuario}</span>
                                    </div>
                                </div>

                                <div className="usr-modal__footer usr-modal__footer--center">
                                    <button
                                        type="button"
                                        className="usr-btn usr-btn--primary"
                                        onClick={() => setDetailUser(null)}
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Modal de Confirmación de Eliminación */}
                {deleteModalOpen && userToDelete && (
                    <div className="usr-modal-backdrop" onClick={() => !actionLoading && setDeleteModalOpen(false)}>
                        <div className="usr-modal usr-modal--sm" onClick={(e) => e.stopPropagation()}>
                            <div className="usr-modal__danger-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                            </div>

                            <div className="usr-modal__danger-content">
                                <h3 className="usr-modal__title">¿Eliminar este usuario?</h3>
                                <p className="usr-modal__subtitle">
                                    Esta acción eliminará de forma permanente al usuario:
                                    <br />
                                    <strong className="usr-highlight">{userToDelete.nombre}</strong> ({userToDelete.correo}).
                                </p>
                                <p className="usr-modal__danger-hint">
                                    Si el usuario tiene tickets o asignaciones asociadas, la base de datos protegerá la integridad y <strong>no permitirá la eliminación</strong>. En ese caso, el usuario se <strong>suspenderá automáticamente</strong> en su lugar.
                                </p>
                            </div>

                            <div className="usr-modal__footer usr-modal__footer--center">
                                <button
                                    type="button"
                                    className="usr-btn usr-btn--secondary"
                                    onClick={() => setDeleteModalOpen(false)}
                                    disabled={actionLoading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="usr-btn usr-btn--danger"
                                    onClick={handleConfirmDelete}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? (
                                        <>
                                            <div className="usr-spin-dot"></div>
                                            <span>Procesando...</span>
                                        </>
                                    ) : (
                                        <span>Sí, Eliminar</span>
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

export default Usuarios;