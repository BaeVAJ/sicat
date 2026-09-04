// src/components/layout/sidebar.jsx
import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './sidebar.css';

// ── SVG Icons (Lucide-style) ──
const icons = {
    dashboard: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    ),
    building: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
            <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
        </svg>
    ),
    department: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    ),
    truck: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
            <path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
            <circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
        </svg>
    ),
    tag: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
            <path d="M7 7h.01" />
        </svg>
    ),
    box: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
        </svg>
    ),
    cart: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
    ),
    warehouse: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
            <path d="M6 18h12" /><path d="M6 14h12" />
        </svg>
    ),
    assign: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
        </svg>
    ),
    receipt: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
            <path d="M12 17.5v-11" />
        </svg>
    ),
    ticket: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
        </svg>
    ),
    plus: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    ),
    logout: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    ),
    menu: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
    ),
    user: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
    more: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    ),
};

// ── Grupos con submenús ──
const grupos = [
    {
        label: 'General',
        icon: 'dashboard',
        roles: ['admin', 'gerente', 'usuario'],
        enlaces: [
            { to: '/Inicio', label: 'Inicio', icon: 'dashboard', roles: ['admin', 'gerente', 'usuario'] },
        ],
    },
    {
        label: 'Organización',
        icon: 'building',
        roles: ['admin'],
        enlaces: [
            { to: '/empresas', label: 'Empresas', icon: 'building', roles: ['admin'] },
            { to: '/departamentos', label: 'Departamentos', icon: 'department', roles: ['admin'] },
        ],
    },
    {
        label: 'Catálogo',
        icon: 'tag',
        roles: ['admin', 'gerente'],
        enlaces: [
            { to: '/categorias', label: 'Categorías', icon: 'tag', roles: ['admin'] },
            { to: '/productos', label: 'Productos', icon: 'box', roles: ['admin', 'gerente'] },
            { to: '/proveedores', label: 'Proveedores', icon: 'truck', roles: ['admin', 'gerente'] },
        ],
    },
    {
        label: 'Operaciones',
        icon: 'warehouse',
        roles: ['admin', 'gerente', 'usuario'],
        enlaces: [
            { to: '/compras', label: 'Compras', icon: 'cart', roles: ['admin', 'gerente'] },
            { to: '/inventario', label: 'Inventario', icon: 'warehouse', roles: ['admin', 'gerente', 'usuario'] },
            { to: '/asignaciones', label: 'Asignaciones', icon: 'assign', roles: ['admin', 'gerente'] },
        ],
    },
    {
        label: 'Documentos',
        icon: 'receipt',
        roles: ['admin', 'gerente'],
        enlaces: [
            { to: '/facturas', label: 'Facturas', icon: 'receipt', roles: ['admin', 'gerente'] },
        ],
    },
    {
        label: 'Soporte',
        icon: 'ticket',
        roles: ['admin', 'gerente', 'usuario'],
        enlaces: [
            { to: '/tickets', label: 'Tickets', icon: 'ticket', roles: ['admin', 'gerente', 'usuario'] },
            { to: '/crear-ticket', label: 'Crear Ticket', icon: 'plus', roles: ['admin', 'gerente', 'usuario'] },
        ],
    },
    {
        label: 'Usuarios',
        icon: 'user',
        roles: ['admin', 'gerente'],
        enlaces: [
            { to: '/Usuarios', label: 'Usuarios', icon: 'user', roles: ['admin', 'gerente'] },
        ],
    },
];

function GrupoMenu({ grupo, rol, onNavigate }) {
    const [abierto, setAbierto] = useState(false);
    const location = useLocation();

    // Filtra enlaces visibles para este rol
    const visibles = grupo.enlaces.filter((e) => e.roles.includes(rol));

    if (visibles.length === 0) return null;

    // Si solo tiene 1 enlace, muestra directo
    if (visibles.length === 1) {
        const { to, label, icon } = visibles[0];
        return (
            <NavLink
                to={to}
                onClick={onNavigate}
                className={({ isActive }) => `sidebar__link ${isActive ? 'active' : ''}`}
            >
                <span className="sidebar__link-icon">{icons[icon]}</span>
                <span className="sidebar__link-label">{label}</span>
            </NavLink>
        );
    }

    const hasActiveChild = visibles.some((e) => location.pathname.toLowerCase() === e.to.toLowerCase());

    return (
        <div className="sidebar__group">
            <button
                type="button"
                className={`sidebar__group-header ${abierto || hasActiveChild ? 'sidebar__group-header--open' : ''}`}
                onClick={() => setAbierto((v) => !v)}
            >
                <span className="sidebar__link-icon">{icons[grupo.icon]}</span>
                <span className="sidebar__link-label">{grupo.label}</span>
                <span className="sidebar__group-arrow">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                            transform: abierto || hasActiveChild ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                        }}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </span>
            </button>

            <div className={`sidebar__submenu ${abierto || hasActiveChild ? 'sidebar__submenu--open' : ''}`}>
                {visibles.map(({ to, label, icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        onClick={onNavigate}
                        className={({ isActive }) => `sidebar__link sidebar__link--sub ${isActive ? 'active' : ''}`}
                    >
                        <span className="sidebar__link-icon">{icons[icon]}</span>
                        <span className="sidebar__link-label">{label}</span>
                    </NavLink>
                ))}
            </div>
        </div>
    );
}

function Sidebar() {
    const { usuario, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Estado para el menú móvil inferior (Bottom Sheet)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Cerrar el menú desplegable al cambiar de ruta
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Obtener iniciales del usuario
    const iniciales = usuario?.nombre
        ? usuario.nombre
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
        : '?';

    const handleLogout = () => {
        logout();
        navigate('/Login');
    };

    const handleCloseMobile = () => {
        setMobileMenuOpen(false);
    };

    // Determinar la ruta de inicio según el rol
    const homeRoute = usuario?.rol === 'usuario' ? '/dashboardUser' : '/Inicio';

    return (
        <>
            {/* ══════════════════════════════════════════════════════════
               1. DESKTOP SIDEBAR (Izquierda colapsable en pantallas > 768px)
               ══════════════════════════════════════════════════════════ */}
            <aside className="sidebar desktop-sidebar">
                {/* Brand */}
                <div className="sidebar__brand">
                    <div className="sidebar__brand-icon" />
                    <div className="sidebar__brand-text">
                        <span className="sidebar__brand-name">SICAT</span>
                        <span className="sidebar__brand-sub">Control de Activos</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="sidebar__nav">
                    {grupos
                        .filter((g) => g.roles.includes(usuario?.rol))
                        .map((grupo) => (
                            <GrupoMenu key={grupo.label} grupo={grupo} rol={usuario?.rol} />
                        ))}
                </nav>

                {/* Footer / User Profile */}
                <div className="sidebar__footer">
                    <div className="sidebar__user">
                        <div className="sidebar__avatar">{iniciales}</div>
                        <div className="sidebar__user-info">
                            <span className="sidebar__user-name">{usuario?.nombre}</span>
                            <span className="sidebar__user-role">{usuario?.rol}</span>
                        </div>
                    </div>
                    <button type="button" className="sidebar__logout" onClick={handleLogout}>
                        <span className="sidebar__link-icon">{icons.logout}</span>
                        <span className="sidebar__logout-label">Cerrar sesión</span>
                    </button>
                </div>
            </aside>

            {/* ══════════════════════════════════════════════════════════
               2. MOBILE BOTTOM NAVIGATION (Barra inferior fija en teléfonos)
               ══════════════════════════════════════════════════════════ */}
            <div className="mobile-bottom-bar">
                {/* 1. Inicio */}
                <NavLink
                    to={homeRoute}
                    className={({ isActive }) => `mobile-bottom-bar__item ${isActive ? 'active' : ''}`}
                >
                    <span className="mobile-bottom-bar__icon">{icons.dashboard}</span>
                    <span className="mobile-bottom-bar__label">Inicio</span>
                </NavLink>

                {/* 2. Productos / Catálogo */}
                {['admin', 'gerente'].includes(usuario?.rol) && (
                    <NavLink
                        to="/productos"
                        className={({ isActive }) => `mobile-bottom-bar__item ${isActive ? 'active' : ''}`}
                    >
                        <span className="mobile-bottom-bar__icon">{icons.box}</span>
                        <span className="mobile-bottom-bar__label">Productos</span>
                    </NavLink>
                )}

                {/* 3. Facturas */}
                {['admin', 'gerente'].includes(usuario?.rol) && (
                    <NavLink
                        to="/facturas"
                        className={({ isActive }) => `mobile-bottom-bar__item ${isActive ? 'active' : ''}`}
                    >
                        <span className="mobile-bottom-bar__icon">{icons.receipt}</span>
                        <span className="mobile-bottom-bar__label">Facturas</span>
                    </NavLink>
                )}

                {/* 4. Tickets */}
                <NavLink
                    to="/tickets"
                    className={({ isActive }) => `mobile-bottom-bar__item ${isActive ? 'active' : ''}`}
                >
                    <span className="mobile-bottom-bar__icon">{icons.ticket}</span>
                    <span className="mobile-bottom-bar__label">Tickets</span>
                </NavLink>

                {/* 5. Botón Menú Completo (Despliega panel inferior) */}
                <button
                    type="button"
                    className={`mobile-bottom-bar__item mobile-bottom-bar__menu-btn ${mobileMenuOpen ? 'active' : ''
                        }`}
                    onClick={() => setMobileMenuOpen((v) => !v)}
                    aria-label="Abrir menú completo"
                >
                    <span className="mobile-bottom-bar__icon">
                        {mobileMenuOpen ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        ) : (
                            icons.more
                        )}
                    </span>
                    <span className="mobile-bottom-bar__label">{mobileMenuOpen ? 'Cerrar' : 'Menú'}</span>
                </button>
            </div>

            {/* ══════════════════════════════════════════════════════════
               3. MOBILE BOTTOM SHEET (Panel desplegable estático inferior)
               ══════════════════════════════════════════════════════════ */}
            {/* Overlay para cerrar al tocar afuera */}
            <div
                className={`mobile-sheet-overlay ${mobileMenuOpen ? 'mobile-sheet-overlay--visible' : ''}`}
                onClick={handleCloseMobile}
            />

            {/* Drawer que emerge desde la parte inferior */}
            <div className={`mobile-bottom-sheet ${mobileMenuOpen ? 'mobile-bottom-sheet--open' : ''}`}>
                {/* Tirador superior táctil */}
                <div className="mobile-sheet__handle-wrap" onClick={handleCloseMobile}>
                    <div className="mobile-sheet__handle" />
                </div>

                {/* Cabecera del panel inferior */}
                <div className="mobile-sheet__header">
                    <div className="mobile-sheet__brand">
                        <div className="sidebar__brand-icon" />
                        <div>
                            <span className="sidebar__brand-name">SICAT</span>
                            <span className="sidebar__brand-sub">Menú del Sistema</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="mobile-sheet__close"
                        onClick={handleCloseMobile}
                        aria-label="Cerrar menú"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Lista de navegación completa */}
                <div className="mobile-sheet__nav">
                    {grupos
                        .filter((g) => g.roles.includes(usuario?.rol))
                        .map((grupo) => (
                            <GrupoMenu
                                key={grupo.label}
                                grupo={grupo}
                                rol={usuario?.rol}
                                onNavigate={handleCloseMobile}
                            />
                        ))}
                </div>

                {/* Footer con información de usuario y cerrar sesión */}
                <div className="mobile-sheet__footer">
                    <div className="sidebar__user" style={{ padding: '8px 12px', margin: 0 }}>
                        <div className="sidebar__avatar">{iniciales}</div>
                        <div className="sidebar__user-info" style={{ opacity: 1 }}>
                            <span className="sidebar__user-name">{usuario?.nombre}</span>
                            <span className="sidebar__user-role">{usuario?.rol}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="sidebar__logout"
                        style={{ width: 'auto', padding: '8px 14px' }}
                        onClick={handleLogout}
                    >
                        <span className="sidebar__link-icon">{icons.logout}</span>
                        <span className="sidebar__logout-label" style={{ opacity: 1 }}>
                            Salir
                        </span>
                    </button>
                </div>
            </div>
        </>
    );
}

export default Sidebar;