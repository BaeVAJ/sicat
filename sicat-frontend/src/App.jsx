import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import Login from './components/Login/Login.jsx';
import FoFPage from './components/404Page/ErrorSVG.jsx';
import Inicio from './components/inicio/Inicio.jsx';
import CrearTicket from './components/Ticket/CrearTicket/CrearTicket.jsx';

import Tickets from './components/Ticket/VerTicket/Tickets.jsx';
import VerEmpresa from './components/Organizacion/Empresa/Empresa.jsx';
import Departamento from './components/Organizacion/Departamento/Departamento.jsx';
import Facturas from './components/Facturas/facturas.jsx';
import ComplementosPago from './components/Facturas/ComplementosPago.jsx';
import EstadoCuentaPpd from './components/Facturas/EstadoCuentaPpd.jsx';
import Productos from './components/catalogo/Productos/Productos.jsx';
import Categorias from './components/catalogo/Categorias/Categorias.jsx';
import Proveedores from './components/catalogo/Proveedores/Proveedores.jsx';
import Usuarios from './components/Usuarios/Usuarios.jsx';
import Compras from './components/Operaciones/Compras/Compras.jsx';
import Inventario from './components/Operaciones/Inventario/Inventario.jsx';
import Asignaciones from './components/Operaciones/Asignaciones/Asignaciones.jsx';
import SolicitarMaterial from './components/Operaciones/SolicitarMaterial/SolicitarMaterial.jsx';

function App() {

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/404" element={<FoFPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
          <Route path="/" element={<Navigate to="/Login" />} />
          <Route path="/Login" element={<Login />} />
          <Route path="/Inicio" element={
            <RutaProtegida rolesPermitidos={['admin', 'gerente', 'usuario']}>
              <Inicio />
            </RutaProtegida>
          } />
          <Route path="/crear-ticket" element={
            <RutaProtegida rolesPermitidos={['admin', 'gerente', 'usuario']}>
              <CrearTicket />
            </RutaProtegida>
          } />
          <Route path="/tickets" element={
            <RutaProtegida rolesPermitidos={['admin', 'gerente', 'usuario']}>
              <Tickets />
            </RutaProtegida>
          } />
          <Route
            path="/empresas"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <VerEmpresa />
              </RutaProtegida>
            }
          />
          <Route
            path="/departamentos"
            element={
              <RutaProtegida rolesPermitidos={['admin']}>
                <Departamento />
              </RutaProtegida>
            }
          />
          <Route
            path="/facturas"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Facturas />
              </RutaProtegida>
            }
          />
          <Route
            path="/complementos-pago"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <ComplementosPago />
              </RutaProtegida>
            }
          />
          <Route
            path="/estado-cuenta-ppd"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <EstadoCuentaPpd />
              </RutaProtegida>
            }
          />
          <Route
            path="/categorias"
            element={
              <RutaProtegida rolesPermitidos={['admin']}>
                <Categorias />
              </RutaProtegida>
            }
          />
          <Route
            path="/productos"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Productos />
              </RutaProtegida>
            }
          />
          <Route
            path="/proveedores"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Proveedores />
              </RutaProtegida>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Usuarios />
              </RutaProtegida>
            }
          />
          <Route
            path="/Usuarios"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Usuarios />
              </RutaProtegida>
            }
          />
          <Route
            path="/compras"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Compras />
              </RutaProtegida>
            }
          />
          <Route
            path="/inventario"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente', 'usuario']}>
                <Inventario />
              </RutaProtegida>
            }
          />
          <Route
            path="/Inventario"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente', 'usuario']}>
                <Inventario />
              </RutaProtegida>
            }
          />
          <Route
            path="/solicitar-material"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente', 'usuario']}>
                <SolicitarMaterial />
              </RutaProtegida>
            }
          />
          <Route
            path="/asignaciones"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Asignaciones />
              </RutaProtegida>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;