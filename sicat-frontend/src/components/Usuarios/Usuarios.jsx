// src/components/Usuarios/Usuarios.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import Layout from '../layout/Layout';
import './Usuarios.css';

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
    const [viewMode, setViewMode] = useState('TABLE');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('CREATE');
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

    const [message, setMessage] = useState({type:'', text:''});

    const [detailUser, setDetailUser] = useState(null);
    const [isMobile, setIsMobile] = useState(false);

    const [idEmpresa, setIdEmpresa] = useState('');

    const [filters, setFilters] = useState({
        usuario:'',
        rol:'',
        estatus:'',
        departamento:'',
        id:'',
    });
    const [sort, setSort] = useState({ key: 'departamento', dir: 'desc' });

    const isEditingSelf =
        modalMode === 'EDIT' &&
        selectedUser &&
        currentUser &&
        selectedUser.id_usuario === currentUser.id_usuario;
        

    useEffect(() => { fetchData(); }, []);

    const showMessage = useCallback((type, text) => {
        setMessage({ type, text});
    }, []);

    useEffect(() => {
        if (message.type === 'success') {
            const t = setTimeout(() => setMessage({type:'', text:''}), 5000);
            return () => clearTimeout(t);
        }
    }, [message]);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [usersRes, deptRes, empRes] = await Promise.all([
                client.get('/usuarios'),
                client.get('/departamentos').catch(() => ({ data: [] })),
                client.get('/empresas').catch(() => ({ data: [] })),
            ]);
            setUsuarios(Array.isArray(usersRes.data) ? usersRes.data : []);
            setDepartamentos(Array.isArray(deptRes.data) ? deptRes.data : []);
            setEmpresas(Array.isArray(empRes.data) ? empRes.data : []);
        } catch (err) {
            const status = err.response?.status;
            const serverError = err.response?.data?.error;
            const errorText = typeof serverError === 'string' ? serverError : '';
            let message = 'Error al cargar los usuarios';

            if (!err.response) {
                message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (errorText.includes('getaddrinfo')) {
                message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
            }
            if (isAdmin) {
                message += ` [${status ?? err.code} | ${errorText || err.message}]`;
            }
            showMessage('error', message);
        } finally {
            setLoading(false);
        }
    };

    const empresaMap = useMemo(() => {
        const m = {};
        empresas.forEach((e) => { m[e.id_empresa] = e.nombre; });
        return m;
    }, [empresas]);

    const departamentoMap = useMemo(() => {
        const m = {};
        departamentos.forEach((d) => {
            m[d.id_departamento] = { ...d, empresa_nombre: empresaMap[d.id_empresa] || '' };
        });
        return m;
    }, [departamentos, empresaMap]);

    const stats = useMemo(() => {
        const total = usuarios.length;
        const activos = usuarios.filter((u) => (u.estatus_empleado || 'activo') === 'activo').length;
        const inactivos = usuarios.filter((u) => (u.estatus_empleado || 'inactivo') === 'inactivo').length;
        const suspendidos = usuarios.filter((u) => (u.estatus_empleado || 'suspendido') === 'suspendido').length;
        const admins = usuarios.filter((u) => u.rol === 'admin').length;
        const gerentes = usuarios.filter((u) => u.rol === 'gerente').length;
        const estandar = usuarios.filter((u) => u.rol === 'usuario').length;
        return { total, activos, inactivos, suspendidos, admins, gerentes, estandar };
    }, [usuarios]);

    const handleOpenCreate = () => {
        setModalMode('CREATE');
        setSelectedUser(null);
        setNombre(''); setCorreo(''); 
        setRol('usuario');
        setIdDepartamento('');
        setEstatusEmpleado('activo');
        setContrasena('');
        setConfirmarContrasena('');
        setMostrarContrasena(false);
        showMessage('', '');
        setModalOpen(true);
        setIdEmpresa('');
    };

    const handleOpenEdit = (user) => {
        if (user.estatus_empleado === 'suspendido') {
            showMessage('error', `El usuario "${user.nombre}" está suspendido y no puede editarse.`)
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
        showMessage('','');
        setModalOpen(true);
        setIdEmpresa(user.id_departamento ? String(departamentoMap[user.id_departamento]?.id_empresa || '') : '');
    };

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!nombre.trim()) return showMessage('error', 'El nombre del usuario es obligatorio.');

        if (!correo.trim()) return showMessage('error', 'El correo electrónico es obligatorio.');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo.trim())) return showMessage('error', 'Ingresa un correo electrónico válido.');

        if (modalMode === 'CREATE') {
            if (!contrasena) return showMessage('error', 'La contraseña inicial es obligatoria.');
            if (contrasena.length < 6) return showMessage('error', 'La contraseña debe tener al menos 6 caracteres.');
            if (contrasena !== confirmarContrasena) return showMessage('error', 'Las contraseñas no coinciden.');
        } else if (modalMode === 'EDIT' && contrasena) {
            if (contrasena.length < 6) return showMessage('error', 'La nueva contraseña debe tener al menos 6 caracteres.');
            if (contrasena !== confirmarContrasena) return showMessage('Las contraseñas no coinciden.');
        }

        setActionLoading(true);

        const payload = {
            nombre: nombre.trim(),
            correo: correo.trim().toLowerCase(),
            rol,
            id_departamento: idDepartamento ? Number(idDepartamento) : null,
        };
        if (modalMode === 'EDIT' && !isEditingSelf) payload.estatus_empleado = estatusEmpleado;
        if (contrasena) payload.contrasena = contrasena;

        try {
            if (modalMode === 'CREATE') {
                const { data } = await client.post('/usuarios', payload);
                setUsuarios((p) => [data, ...p]);
                showMessage('success', `Usuario "${data.nombre}" creado exitosamente.`);
            } else {
                const { data } = await client.put(`/usuarios/${selectedUser.id_usuario}`, payload);
                setUsuarios((p) => p.map((u) => (u.id_usuario === selectedUser.id_usuario ? data : u)));
                showMessage('success', `Usuario "${data.nombre}" actualizado correctamente.`);
            }
            setModalOpen(false);
        } catch (err) {
            if(err.response?.data?.error?.includes('getaddrinfo ')) return showMessage('error', 'Error de conexión al servidor. \n Verifica tu conexión a internet o contacta al administrador.');
            showMessage('error', String(err.response?.data?.error || 'Error al procesar la solicitud.'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenDelete = (user) => { setUserToDelete(user); setDeleteModalOpen(true); };
    const handleOpenDetail = (user) => { setDetailUser(user); };

    const handleConfirmDelete = async () => {
        if (!userToDelete) return;
        setActionLoading(true); setError('');
        try {
            await client.delete(`/usuarios/${userToDelete.id_usuario}`);
            setUsuarios((p) => p.filter((u) => u.id_usuario !== userToDelete.id_usuario));
            showMessage('success', `Usuario "${userToDelete.nombre}" eliminado exitosamente.`)
            
            setDeleteModalOpen(false); setUserToDelete(null);
        } catch (err) {
            const status = err.response?.status;
            const msg = err.response?.data?.error || '';
            const bloqueo = status === 409 && /tickets|asignaciones|registros|integridad|asociad/i.test(msg);
            if (bloqueo) {
                try {
                    const { data } = await client.put(`/usuarios/${userToDelete.id_usuario}`, {
                        nombre: userToDelete.nombre,
                        correo: userToDelete.correo,
                        rol: userToDelete.rol,
                        id_departamento: userToDelete.id_departamento,
                        estatus_empleado: 'suspendido',
                    });
                    setUsuarios((p) => p.map((u) => (u.id_usuario === data.id_usuario ? data : u)));
                    showMessage('success', `El usuario "${data.nombre}" tiene registros asociados. Se cambió a "Suspendido".`);
                    setDeleteModalOpen(false);
                    setUserToDelete(null);
                } catch (err) {
                    showMessage('error', String(err.response?.data?.error || 'No se pudo eliminar ni suspender el usuario.'));
                    setDeleteModalOpen(false);
                }
            } else {
                const status = err.response?.status;
                const serverError = err.response?.data?.error;
                const errorText = typeof serverError === 'string' ? serverError : '';
                let message = 'Error al cargar los usuarios';

                if (!err.response) {
                    message = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
                } else if (errorText.includes('getaddrinfo')) {
                    message = 'El servidor no pudo conectar con un servicio externo. Inténtalo más tarde.';
                }
                if (isAdmin) {
                    message += ` [${status ?? err.code} | ${errorText || err.message}]`;
                }
                showMessage('error', message);
            }
        } finally {
            setActionLoading(false);
        }
    };

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

    function valorOrden(item, key) {
        switch (key) {
            case 'id':
                return item.id_usuario;
            case 'usuario':
                return normalizar(item.nombre);
            case 'rol':
                return normalizar(item.rol);
            case 'estatus':
                return normalizar(item.estatus_empleado);
            case 'departamento':
                return normalizar(item.departamento_nombre );
            default:
                return item[key] ?? null;
        }
    }

    const departamentoFilter = useMemo(() => {

        if (!idEmpresa) return departamentos;
        return departamentos.filter((d) => {
            if (idEmpresa !== String(d.id_empresa)) return false;
            if(idEmpresa && String(d.id_empresa) !== String(idEmpresa)) return false;
            return true;
        });
    }, [departamentos, idEmpresa]);

    const usuariosFiltrados = useMemo(() => {
        const lista = usuarios.filter((u) => {
            const q = search.toLowerCase();
            const matchSearch =
                (u.nombre || '').toLowerCase().includes(q) ||
                (u.correo || '').toLowerCase().includes(q) ||
                (u.departamento_nombre || '').toLowerCase().includes(q) ||
                (u.empresa_nombre || '').toLowerCase().includes(q) ||
                (u.rol || '').toLowerCase().includes(q);
            if (!matchSearch) return false;
            if (filterRol !== 'ALL' && u.rol !== filterRol) return false;
            if (filterEstatus !== 'ALL' && (u.estatus_empleado || 'activo') !== filterEstatus) return false;
            if (filterDepartamento !== 'ALL') {
                if (filterDepartamento === 'NONE') { if (u.id_departamento) return false; }
                else if (String(u.id_departamento) !== filterDepartamento) return false;
            }
            return true;
        });
        const factor = sort.dir === 'asc' ? 1 : -1;
        return [...lista].sort((a, b) => {
            const va = valorOrden(a, sort.key);
            const vb = valorOrden(b, sort.key);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (va < vb) return -1 * factor;
            if (va > vb) return 1 * factor;
            return 0;
        });
    }, [usuarios, search, filterRol, filterDepartamento, filterEstatus, sort, filters]);

    const getInitials = (name) => {
        if (!name) return 'U';
        const p = name.trim().split(' ');
        return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    };

    const getRoleBadge = (rolName) => {
        switch (rolName) {
            case 'admin':
                return {
                    label: 'Administrador', className: 'usr-badge--admin',
                    icon: (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>),
                };
            case 'gerente':
                return {
                    label: 'Gerente', className: 'usr-badge--gerente',
                    icon: (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
                };
            default:
                return {
                    label: 'Usuario', className: 'usr-badge--usuario',
                    icon: (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="7" r="4" /><path d="M5.5 21a8.38 8.38 0 0 1 13 0" /></svg>),
                };
        }
    };

    const getEstatusLabel = (est) => {
        const v = est || 'activo';
        return v.charAt(0).toUpperCase() + v.slice(1);
    };

    const isAdmin = currentUser?.rol === 'admin';
    const hasFilters = search || filterRol !== 'ALL' || filterDepartamento !== 'ALL' || filterEstatus !== 'ALL';

    const handleDepartamentoChange = (v) => {
        if(!v) { 
            setIdDepartamento('');
            return;
        }
        const selectedDept = departamentos.find((d) => String(d.id_departamento) === v);
        if(selectedDept && !idEmpresa) setIdEmpresa(String(selectedDept.id_empresa));
        if(idEmpresa !== String(selectedDept?.id_empresa)) setIdEmpresa(String(selectedDept?.id_empresa));
        setIdDepartamento(v);
    };

    const handleEmpresaChange = (v) => {
        setIdEmpresa(v);
        if(idDepartamento){
           const departamentoElegido = departamentos.find((d) => String(d.id_departamento) === idDepartamento);
           if(departamentoElegido && String(departamentoElegido.id_empresa) !== v){
                setIdDepartamento('');
           }
        }
    }

    return (
        <Layout>
            <div className="usr-page">
                <div className="usr-hero">
                    <div className="usr-hero__content">
                        <div className="usr-hero__icon">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="usr-hero__title">Usuarios</h1>
                            <p className="usr-hero__subtitle">Gestiona cuentas, roles y accesos de la plataforma SICAT</p>
                        </div>
                    </div>
                    <div className="usr-hero__actions">
                        <button type="button" className="usr-btn usr-btn--secondary" onClick={fetchData} disabled={loading}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'usr-spin' : ''}>
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                            <span>Refrescar</span>
                        </button>
                        {isAdmin && (
                            <button type="button" className="usr-btn usr-btn--primary" onClick={handleOpenCreate}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Nuevo Usuario</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── KPIs ── */}
                {!loading && (
                    <div className="usr-kpi-grid">
                        <div className="usr-kpi">
                            <div className="usr-kpi__top">
                                <span className="usr-kpi__label">Total Usuarios</span>
                                <div className="usr-kpi__icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                    </svg>
                                </div>
                            </div>
                            <div className="usr-kpi__value">{stats.total}</div>
                            
                        </div>

                        <div className="usr-kpi">
                            <div className="usr-kpi__top">
                                <span className="usr-kpi__label">Activos</span>
                                <div className="usr-kpi__icon usr-kpi__icon--success">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                </div>
                            </div>
                            <div className="usr-kpi__value">{stats.activos}</div>
                            
                        </div>

                        <div className="usr-kpi">
                            <div className="usr-kpi__top">
                                <span className="usr-kpi__label">Inactivos</span>
                                <div className="usr-kpi__icon usr-kpi__icon--warning">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                </div>
                            </div>
                            <div className="usr-kpi__value">{stats.inactivos}</div>
                            
                        </div>

                        <div className="usr-kpi">
                            <div className="usr-kpi__top">
                                <span className="usr-kpi__label">Suspendidos</span>
                                <div className="usr-kpi__icon usr-kpi__icon--danger">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                    </svg>
                                </div>
                            </div>
                            <div className="usr-kpi__value">{stats.suspendidos}</div>
                            
                        </div>
                    </div>
                )}

                {/* ── ALERTAS ── */}
                {alerta}
                {/* ── TOOLBAR ── */}
                <div className="usr-toolbar">
                    <div className="usr-search">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="usr-search__icon">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, correo, rol o departamento..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="usr-search__input"
                        />
                        {search && (
                            <button type="button" className="usr-search__clear" onClick={() => setSearch('')}>×</button>
                        )}
                    </div>

                    <div className="usr-filters">
                        <select className="usr-select" value={filterRol} onChange={(e) => setFilterRol(e.target.value)}>
                            <option value="ALL">Todos los roles</option>
                            <option value="admin">Administrador</option>
                            <option value="gerente">Gerente</option>
                            <option value="usuario">Usuario</option>
                        </select>

                        <select className="usr-select" value={filterEstatus} onChange={(e) => setFilterEstatus(e.target.value)}>
                            <option value="ALL">Todos los estatus</option>
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                            <option value="suspendido">Suspendido</option>
                        </select>

                        <select className="usr-select" value={filterDepartamento} onChange={(e) => setFilterDepartamento(e.target.value)}>
                            <option value="ALL">Todos los departamentos</option>
                            <option value="NONE">Sin departamento</option>
                            {departamentos.map((d) => (
                                <option key={d.id_departamento} value={String(d.id_departamento)}>
                                    {d.nombre} {empresaMap[d.id_empresa] ? `(${empresaMap[d.id_empresa]})` : ''}
                                </option>
                            ))}
                        </select>

                        <div className="usr-segment">
                            <button
                                type="button"
                                className={`usr-segment__btn ${viewMode === 'TABLE' ? 'active' : ''}`}
                                onClick={() => setViewMode('TABLE')}
                                title="Vista en tabla"
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
                                className={`usr-segment__btn ${viewMode === 'GRID' ? 'active' : ''}`}
                                onClick={() => setViewMode('GRID')}
                                title="Vista en tarjetas"
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
                    <div className="usr-state">
                        <div className="usr-spinner"></div>
                        <p>Cargando información de usuarios...</p>
                    </div>
                ) : usuariosFiltrados.length === 0 ? (
                    <div className="usr-state">
                        <div className="usr-state__icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <line x1="17" y1="8" x2="23" y2="14" />
                                <line x1="23" y1="8" x2="17" y2="14" />
                            </svg>
                        </div>
                        <h3>No se encontraron usuarios</h3>
                        <p>
                            {hasFilters
                                ? 'No hay resultados que coincidan con los filtros aplicados.'
                                : 'Actualmente no hay usuarios registrados en el sistema.'}
                        </p>
                        {hasFilters && (
                            <button
                                type="button"
                                className="usr-btn usr-btn--secondary"
                                onClick={() => {
                                    setSearch(''); setFilterRol('ALL');
                                    setFilterDepartamento('ALL'); setFilterEstatus('ALL');
                                }}
                            >
                                Restablecer Filtros
                            </button>
                        )}
                    </div>
                ) : viewMode === 'TABLE' ? (
                    <div className="usr-table-wrap">
                        <table className="usr-table">
                            <thead>
                                <tr>
                                    <SortHeader label="Usuario" sortKey="usuario" sort={sort} onSort={toggleSort} />
                                    <SortHeader label="Rol" sortKey="rol" sort={sort} onSort={toggleSort} />
                                    <SortHeader label="Estatus" sortKey="estatus" sort={sort} onSort={toggleSort} />
                                    {!isMobile && <SortHeader label="Departamento" sortKey="departamento" sort={sort} onSort={toggleSort} />}
                                    {!isMobile && <SortHeader label="ID" sortKey="id" sort={sort} onSort={toggleSort} />}
                                    <th className="usr-table__right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuariosFiltrados.map((u) => {
                                    const badge = getRoleBadge(u.rol);
                                    const isSelf = currentUser?.id_usuario === u.id_usuario;
                                    const isSuspended = u.estatus_empleado === 'suspendido';
                                    const info = u.id_departamento ? departamentoMap[u.id_departamento] : null;
                                    const deptoNombre = u.departamento_nombre || info?.nombre;
                                    const empresaNombre = u.empresa_nombre || info?.empresa_nombre;
                                    const estatus = u.estatus_empleado || 'activo';

                                    return (
                                        <tr key={u.id_usuario} className={isSelf ? 'usr-table__row--self' : ''}>
                                            <td>
                                                <div className="usr-profile">
                                                    <div className={`usr-avatar usr-avatar--${u.rol}`}>
                                                        {getInitials(u.nombre)}
                                                        <span className={`usr-avatar__status usr-avatar__status--${estatus}`} />
                                                    </div>
                                                    <div>
                                                        <div className="usr-profile__name">
                                                            {u.nombre}
                                                            {isSelf && <span className="usr-self-pill">Tú</span>}
                                                        </div>
                                                        <div className="usr-profile__email">{u.correo}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`usr-badge ${badge.className}`}>
                                                    {badge.icon}<span>{badge.label}</span>
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`usr-status usr-status--${estatus}`}>
                                                    {getEstatusLabel(estatus)}
                                                </span>
                                            </td>
                                            {!isMobile && (
                                                <td className="col-depto">
                                                    {deptoNombre ? (
                                                        <div className="usr-depto">
                                                            <span className="usr-depto__name">{deptoNombre}</span>
                                                            {empresaNombre && <span className="usr-depto__company">{empresaNombre}</span>}
                                                        </div>
                                                    ) : (
                                                        <span className="usr-depto__empty">Sin departamento</span>
                                                    )}
                                                </td>
                                            )}
                                            {!isMobile && (
                                                <td className="col-id"><span className="usr-id">#{u.id_usuario}</span></td>
                                            )}
                                            <td className="usr-table__right">
                                                <div className="usr-row-actions">
                                                    {isMobile && (
                                                        <button type="button" className="usr-action usr-action--view" onClick={() => handleOpenDetail(u)} title="Ver detalles">
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
                                                                className="usr-action usr-action--edit"
                                                                onClick={() => handleOpenEdit(u)}
                                                                disabled={isSuspended}
                                                                title={isSuspended ? 'Usuario suspendido — no editable' : 'Editar usuario'}
                                                            >
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="usr-action usr-action--delete"
                                                                onClick={() => handleOpenDelete(u)}
                                                                disabled={isSelf || isSuspended}
                                                                title={isSelf ? 'No puedes eliminar tu propia cuenta' : isSuspended ? 'Usuario suspendido — no eliminable' : 'Eliminar usuario'}
                                                            >
                                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <polyline points="3 6 5 6 21 6" />
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                </svg>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="usr-readonly">Solo lectura</span>
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
                    <div className="usr-grid">
                        {usuariosFiltrados.map((u) => {
                            const badge = getRoleBadge(u.rol);
                            const isSelf = currentUser?.id_usuario === u.id_usuario;
                            const isSuspended = u.estatus_empleado === 'suspendido';
                            const info = u.id_departamento ? departamentoMap[u.id_departamento] : null;
                            const deptoNombre = u.departamento_nombre || info?.nombre;
                            const empresaNombre = u.empresa_nombre || info?.empresa_nombre;
                            const estatus = u.estatus_empleado || 'activo';

                            return (
                                <div key={u.id_usuario} className={`usr-card ${isSelf ? 'usr-card--self' : ''}`}>
                                    <div className="usr-card__top">
                                        <div className={`usr-avatar usr-avatar--lg usr-avatar--${u.rol}`}>
                                            {getInitials(u.nombre)}
                                            <span className={`usr-avatar__status usr-avatar__status--${estatus}`} />
                                        </div>
                                        <div className="usr-card__badges">
                                            <span className={`usr-badge ${badge.className}`}>
                                                {badge.icon}<span>{badge.label}</span>
                                            </span>
                                            <span className={`usr-status usr-status--${estatus}`}>
                                                {getEstatusLabel(estatus)}
                                            </span>
                                        </div>
                                    </div>

                                    <h3 className="usr-card__name">
                                        {u.nombre}
                                        {isSelf && <span className="usr-self-pill">Tú</span>}
                                    </h3>
                                    <p className="usr-card__email">{u.correo}</p>

                                    <div className="usr-card__meta">
                                        <div className="usr-card__meta-row">
                                            <span className="usr-card__meta-label">Departamento</span>
                                            <span className="usr-card__meta-val">{deptoNombre || 'No asignado'}</span>
                                        </div>
                                        {empresaNombre && (
                                            <div className="usr-card__meta-row">
                                                <span className="usr-card__meta-label">Empresa</span>
                                                <span className="usr-card__meta-val">{empresaNombre}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="usr-card__footer">
                                        <span className="usr-id">ID #{u.id_usuario}</span>
                                        {isAdmin && (
                                            <div className="usr-card__actions">
                                                <button
                                                    type="button"
                                                    className="usr-card-btn usr-card-btn--edit"
                                                    onClick={() => handleOpenEdit(u)}
                                                    disabled={isSuspended}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

                {/* ── MODAL CREAR / EDITAR ── */}
                {modalOpen && (
                    <div className="usr-modal-bg" onClick={() => !actionLoading && setModalOpen(false)}>
                        <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="usr-modal__head">
                                <div className="usr-modal__head-icon">
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
                                    <p className="usr-modal__sub">
                                        {modalMode === 'CREATE'
                                            ? 'Completa los datos para dar de alta una nueva cuenta en SICAT'
                                            : `Actualizando los datos de: ${selectedUser?.nombre}`}
                                    </p>
                                </div>
                                <button type="button" className="usr-modal__close" onClick={() => setModalOpen(false)} disabled={actionLoading}>×</button>
                            </div>

                            <form onSubmit={handleSubmit} className="usr-form">
                                {alerta}

                                <div className="usr-form__grid">
                                    <div className="usr-form__group usr-form__group--full">
                                        <label>Nombre Completo *</label>
                                        <input type="text" placeholder="Ej. Juan Pérez Gómez" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
                                    </div>

                                    <div className="usr-form__group">
                                        <label>Correo Electrónico *</label>
                                        <input type="email" placeholder="usuario@empresa.com" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
                                    </div>

                                    <div className="usr-form__group">
                                        <label>Rol de Seguridad *</label>
                                        <select value={rol} onChange={(e) => setRol(e.target.value)} required>
                                            <option value="usuario">Usuario Estándar</option>
                                            <option value="gerente">Gerente</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </div>

                                    <div className="usr-form__group usr-form__group">
                                        <label>Empresa Asignada</label>
                                        <select value={idEmpresa} onChange={(e) => handleEmpresaChange(e.target.value)} required>
                                            <option value="">-- Sin Empresa Asignada --</option>
                                            {empresas.map((d) => (
                                                <option key={d.id_empresa} value={String(d.id_empresa)}>
                                                    {empresaMap[d.id_empresa] ? `${empresaMap[d.id_empresa]}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="usr-form__group usr-form__group">
                                        <label>Departamento Asignado</label>
                                        <select value={idDepartamento} onChange={(e) => handleDepartamentoChange(e.target.value)} required>
                                            <option value="">-- Sin Departamento Asignado --</option>
                                            {departamentoFilter.map((d) => (
                                                <option key={d.id_departamento} value={String(d.id_departamento)}>
                                                    {d.nombre} {empresaMap[d.id_empresa] ? `(${empresaMap[d.id_empresa]})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {modalMode === 'EDIT' && (
                                        <div className="usr-form__group usr-form__group--full">
                                            <label>
                                                Estatus del Empleado *
                                                {isEditingSelf && <span className="usr-form__hint"> (no puedes cambiar tu propio estatus)</span>}
                                            </label>
                                            <select
                                                value={estatusEmpleado}
                                                onChange={(e) => setEstatusEmpleado(e.target.value)}
                                                disabled={isEditingSelf}
                                                required
                                            >
                                                <option value="activo">Activo</option>
                                                <option value="inactivo">Inactivo</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="usr-form__group">
                                        <label>{modalMode === 'CREATE' ? 'Contraseña Inicial *' : 'Nueva Contraseña (Opcional)'}</label>
                                        <div className="usr-pass">
                                            <input
                                                type={mostrarContrasena ? 'text' : 'password'}
                                                placeholder={modalMode === 'CREATE' ? 'Mínimo 6 caracteres' : 'Dejar en blanco para mantener'}
                                                value={contrasena}
                                                onChange={(e) => setContrasena(e.target.value)}
                                            />
                                            <button type="button" className="usr-pass__toggle" onClick={() => setMostrarContrasena(!mostrarContrasena)} tabIndex="-1">
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
                                        <label>Confirmar Contraseña</label>
                                        <div className="usr-pass">
                                            <input
                                                type={mostrarContrasena ? 'text' : 'password'}
                                                placeholder="Repetir contraseña"
                                                value={confirmarContrasena}
                                                onChange={(e) => setConfirmarContrasena(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="usr-modal__footer">
                                    <button type="button" className="usr-btn usr-btn--secondary" onClick={() => setModalOpen(false)} disabled={actionLoading}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="usr-btn usr-btn--primary" disabled={actionLoading}>
                                        {actionLoading ? (
                                            <><div className="usr-spin-dot"></div><span>Guardando...</span></>
                                        ) : (
                                            <span>{modalMode === 'CREATE' ? 'Crear Usuario' : 'Guardar Cambios'}</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── MODAL DETALLE ── */}
                {detailUser && (() => {
                    const dB = getRoleBadge(detailUser.rol);
                    const dInfo = detailUser.id_departamento ? departamentoMap[detailUser.id_departamento] : null;
                    const dDepto = detailUser.departamento_nombre || dInfo?.nombre;
                    const dEmp = detailUser.empresa_nombre || dInfo?.empresa_nombre;
                    const dEst = detailUser.estatus_empleado || 'activo';
                    return (
                        <div className="usr-modal-bg" onClick={() => setDetailUser(null)}>
                            <div className="usr-modal usr-modal--sm" onClick={(e) => e.stopPropagation()}>
                                <button type="button" className="usr-modal__close" onClick={() => setDetailUser(null)}>×</button>
                                <div className="usr-detail__top">
                                    <div className={`usr-avatar usr-avatar--lg usr-avatar--${detailUser.rol}`}>
                                        {getInitials(detailUser.nombre)}
                                    </div>
                                    <div>
                                        <h3 className="usr-modal__title">{detailUser.nombre}</h3>
                                        <span className={`usr-badge ${dB.className}`} style={{ marginTop: 6 }}>
                                            {dB.icon}<span>{dB.label}</span>
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
                                        <span className={`usr-status usr-status--${dEst}`}>{getEstatusLabel(dEst)}</span>
                                    </div>
                                    <div className="usr-detail__item">
                                        <span className="usr-detail__label">Departamento</span>
                                        <span className="usr-detail__value">{dDepto || 'No asignado'}</span>
                                    </div>
                                    <div className="usr-detail__item">
                                        <span className="usr-detail__label">Empresa</span>
                                        <span className="usr-detail__value">{dEmp || 'No asignada'}</span>
                                    </div>
                                    <div className="usr-detail__item">
                                        <span className="usr-detail__label">ID de usuario</span>
                                        <span className="usr-id">#{detailUser.id_usuario}</span>
                                    </div>
                                </div>

                                <div className="usr-modal__footer usr-modal__footer--center">
                                    <button type="button" className="usr-btn usr-btn--primary" onClick={() => setDetailUser(null)}>Cerrar</button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ── MODAL ELIMINAR ── */}
                {deleteModalOpen && userToDelete && (
                    <div className="usr-modal-bg" onClick={() => !actionLoading && setDeleteModalOpen(false)}>
                        <div className="usr-modal usr-modal--sm" onClick={(e) => e.stopPropagation()}>
                            <div className="usr-modal__danger">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                            </div>

                            <h3 className="usr-modal__title">¿Eliminar este usuario?</h3>
                            <p className="usr-modal__sub">
                                Esta acción eliminará permanentemente a:<br />
                                <strong className="usr-highlight">{userToDelete.nombre}</strong> ({userToDelete.correo}).
                            </p>
                            <p className="usr-hint">
                                Si el usuario tiene tickets o asignaciones asociadas, la integridad de la BD <strong>impedirá la eliminación</strong>. En ese caso, se <strong>suspenderá automáticamente</strong>.
                            </p>
                            <div className="usr-modal__footer usr-modal__footer--center">
                                <button type="button" className="usr-btn usr-btn--secondary" onClick={() => setDeleteModalOpen(false)} disabled={actionLoading}>
                                    Cancelar
                                </button>
                                <button type="button" className="usr-btn usr-btn--danger" onClick={handleConfirmDelete} disabled={actionLoading}>
                                    {actionLoading ? (
                                        <><div className="usr-spin-dot"></div><span>Procesando...</span></>
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