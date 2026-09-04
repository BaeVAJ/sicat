// src/components/Usuarios/Usuarios.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import './Usuarios.css';

function Usuarios() {
    const { usuario: currentUser } = useAuth();

    // Estados principales de datos
    const [usuarios, setUsuarios] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Notificaciones / Mensajes
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Filtros y Visualización
    const [search, setSearch] = useState('');
    const [filterRol, setFilterRol] = useState('ALL');
    const [filterDepartamento, setFilterDepartamento] = useState('ALL');
    const [viewMode, setViewMode] = useState('TABLE'); // 'TABLE' | 'GRID'

    // Modal Crear / Editar
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
    const [selectedUser, setSelectedUser] = useState(null);

    // Campos del formulario
    const [nombre, setNombre] = useState('');
    const [correo, setCorreo] = useState('');
    const [rol, setRol] = useState('usuario');
    const [idDepartamento, setIdDepartamento] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [confirmarContrasena, setConfirmarContrasena] = useState('');
    const [mostrarContrasena, setMostrarContrasena] = useState(false);
    const [formError, setFormError] = useState('');

    // Modal Eliminar
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    // Cargar datos al montar
    useEffect(() => {
        fetchData();
    }, []);

    // Limpiar alertas de éxito después de 4 segundos
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(''), 4000);
            return () => clearTimeout(timer);
        }
    }, [success]);

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

    // Mapa auxiliar: id_empresa -> Nombre Empresa
    const empresaMap = useMemo(() => {
        const map = {};
        empresas.forEach(e => {
            map[e.id_empresa] = e.nombre;
        });
        return map;
    }, [empresas]);

    // Mapa auxiliar: id_departamento -> Objeto Departamento
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

    // Abrir modal de creación
    const handleOpenCreate = () => {
        setModalMode('CREATE');
        setSelectedUser(null);
        setNombre('');
        setCorreo('');
        setRol('usuario');
        setIdDepartamento('');
        setContrasena('');
        setConfirmarContrasena('');
        setMostrarContrasena(false);
        setFormError('');
        setModalOpen(true);
    };

    // Abrir modal de edición
    const handleOpenEdit = (user) => {
        setModalMode('EDIT');
        setSelectedUser(user);
        setNombre(user.nombre || '');
        setCorreo(user.correo || '');
        setRol(user.rol || 'usuario');
        setIdDepartamento(user.id_departamento ? String(user.id_departamento) : '');
        setContrasena('');
        setConfirmarContrasena('');
        setMostrarContrasena(false);
        setFormError('');
        setModalOpen(true);
    };

    // Guardar Usuario (Crear o Modificar)
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        // Validaciones básicas
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

    // Abrir modal eliminar
    const handleOpenDelete = (user) => {
        setUserToDelete(user);
        setDeleteModalOpen(true);
    };

    // Confirmar eliminación
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
            setError(err.response?.data?.error || 'Error al eliminar el usuario.');
            setDeleteModalOpen(false);
        } finally {
            setActionLoading(false);
        }
    };

    // Filtrado de usuarios
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

            if (filterDepartamento !== 'ALL') {
                if (filterDepartamento === 'NONE') {
                    if (u.id_departamento) return false;
                } else if (String(u.id_departamento) !== filterDepartamento) {
                    return false;
                }
            }

            return true;
        });
    }, [usuarios, search, filterRol, filterDepartamento]);

    // Métricas
    const stats = useMemo(() => {
        const total = usuarios.length;
        const admins = usuarios.filter((u) => u.rol === 'admin').length;
        const gerentes = usuarios.filter((u) => u.rol === 'gerente').length;
        const estandar = usuarios.filter((u) => u.rol === 'usuario').length;
        const conDepto = usuarios.filter((u) => u.id_departamento).length;
        return { total, admins, gerentes, estandar, conDepto };
    }, [usuarios]);

    // Iniciales para el avatar
    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    // Color del badge del rol
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

    const isAdmin = currentUser?.rol === 'admin';

    return (
        <Layout>
            <div className="usr-page">
                {/* ── Encabezado ── */}
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
                                Control de accesos, roles de seguridad y asignación de departamentos
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

                {/* ── Alertas Globales ── */}
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

                {/* ── Barra de Control: Búsqueda, Filtros y Modo de Vista ── */}
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
                        {/* Filtro por Rol */}
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

                        {/* Filtro por Departamento */}
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

                        {/* Switch de Vistas */}
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

                {/* ── Contenido Principal ── */}
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
                            {search || filterRol !== 'ALL' || filterDepartamento !== 'ALL'
                                ? 'No hay resultados que coincidan con los filtros aplicados.'
                                : 'Actualmente no hay usuarios registrados en el sistema.'}
                        </p>
                        {(search || filterRol !== 'ALL' || filterDepartamento !== 'ALL') && (
                            <button
                                type="button"
                                className="usr-btn usr-btn--secondary"
                                onClick={() => {
                                    setSearch('');
                                    setFilterRol('ALL');
                                    setFilterDepartamento('ALL');
                                }}
                            >
                                Restablecer Filtros
                            </button>
                        )}
                    </div>
                ) : viewMode === 'TABLE' ? (
                    /* ── VISTA EN TABLA ── */
                    <div className="usr-table-container">
                        <table className="usr-table">
                            <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Rol</th>
                                    <th>Departamento / Empresa</th>
                                    <th>ID</th>
                                    <th className="usr-table__text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuariosFiltrados.map((u) => {
                                    const badge = getRoleBadge(u.rol);
                                    const isSelf = currentUser?.id_usuario === u.id_usuario;
                                    const deptoInfo = u.id_departamento ? departamentoMap[u.id_departamento] : null;
                                    const deptoNombre = u.departamento_nombre || deptoInfo?.nombre;
                                    const empresaNombre = u.empresa_nombre || deptoInfo?.empresa_nombre;

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
                                            <td>
                                                <span className="usr-id-code">#{u.id_usuario}</span>
                                            </td>
                                            <td className="usr-table__text-right">
                                                <div className="usr-row-actions">
                                                    {isAdmin ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="usr-action-btn usr-action-btn--edit"
                                                                onClick={() => handleOpenEdit(u)}
                                                                title="Editar usuario"
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
                                                                disabled={isSelf}
                                                                title={isSelf ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
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
                    /* ── VISTA EN MOSAICO / CARDS ── */
                    <div className="usr-cards-grid">
                        {usuariosFiltrados.map((u) => {
                            const badge = getRoleBadge(u.rol);
                            const isSelf = currentUser?.id_usuario === u.id_usuario;
                            const deptoInfo = u.id_departamento ? departamentoMap[u.id_departamento] : null;
                            const deptoNombre = u.departamento_nombre || deptoInfo?.nombre;
                            const empresaNombre = u.empresa_nombre || deptoInfo?.empresa_nombre;

                            return (
                                <div key={u.id_usuario} className={`usr-card ${isSelf ? 'usr-card--self' : ''}`}>
                                    <div className="usr-card__header">
                                        <div className={`usr-avatar usr-avatar--lg usr-avatar--${u.rol}`}>
                                            {getInitials(u.nombre)}
                                        </div>
                                        <span className={`usr-badge ${badge.className}`}>
                                            {badge.icon}
                                            <span>{badge.label}</span>
                                        </span>
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
                                                    title="Editar usuario"
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
                                                    disabled={isSelf}
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

                {/* ── Modal: Crear / Editar Usuario ── */}
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
                                    {/* Nombre Completo */}
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

                                    {/* Correo Electrónico */}
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

                                    {/* Rol */}
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

                                    {/* Departamento */}
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

                                    {/* Contraseña */}
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

                                    {/* Confirmar Contraseña */}
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

                {/* ── Modal: Confirmar Eliminación ── */}
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
                                    Si el usuario tiene tickets o asignaciones asociadas, la base de datos protegerá la integridad y no permitirá la eliminación.
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
                                            <span>Eliminando...</span>
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