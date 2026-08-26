import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RutaProtegida({ children, rolesPermitidos }) {
  const { usuario, cargando } = useAuth();

  if (cargando) return (
    <div className="flex items-center justify-center h-screen text-gray-500">
      Cargando...
    </div>
  );

  if (!usuario) return <Navigate to="/Login" replace />;

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol))
    return <Navigate to="/404" replace />;

  return children;
}

export default RutaProtegida;