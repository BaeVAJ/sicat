import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const enlaces = [
  { to: '/dashboard',     label: 'Dashboard',        roles: ['admin','gerente'] },
  { to: '/empresas',      label: 'Empresas',          roles: ['admin'] },
  { to: '/departamentos', label: 'Departamentos',     roles: ['admin'] },
  { to: '/proveedores',   label: 'Proveedores',       roles: ['admin','gerente'] },
  { to: '/categorias',    label: 'Categorías',        roles: ['admin'] },
  { to: '/productos',     label: 'Productos',         roles: ['admin','gerente'] },
  { to: '/compras',       label: 'Compras',           roles: ['admin','gerente'] },
  { to: '/inventario',    label: 'Inventario',        roles: ['admin','gerente','usuario'] },
  { to: '/asignaciones',  label: 'Asignaciones',      roles: ['admin','gerente'] },
  { to: '/facturas',      label: 'Facturas',          roles: ['admin','gerente'] },
  { to: '/tickets',       label: 'Tickets',           roles: ['admin','gerente','usuario'] },
  { to: '/crear-ticket',  label: '🚨 Pedir Material', roles: ['admin','gerente','usuario'] },
];

function Sidebar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const visibles = enlaces.filter(e => e.roles.includes(usuario?.rol));

  return (
    <aside className="w-60 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-xl font-bold">SICAT</h1>
        <p className="text-xs text-gray-400 mt-0.5">Control de Activos</p>
      </div>
      <div className="px-6 py-4 border-b border-gray-700">
        <p className="text-sm font-medium truncate">{usuario?.nombre}</p>
        <p className="text-xs text-gray-400 capitalize">{usuario?.rol}</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibles.map(({ to, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm transition-colors duration-150 ` +
              (isActive ? 'bg-blue-600 text-white font-medium'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-700">
        <button onClick={() => { logout(); navigate('/Login'); }}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-300
                     hover:bg-red-600 hover:text-white transition-colors duration-150">
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;