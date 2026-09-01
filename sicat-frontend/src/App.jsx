import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import Login from './components/Login/Login.jsx';
import FoFPage from './components/404Page/ErrorSVG.jsx';
import DashboardAdmin from './components/DashboardAdmin/DashboardAdmin.jsx';
import CrearTicket from './components/Ticket/CrearTicket/CrearTicket.jsx';

import Tickets from './components/Ticket/VerTicket/Tickets.jsx';
import VerEmpresa from './components/Organizacion/Empresa/Empresa.jsx';
import Departamento from './components/Organizacion/Departamento/Departamento.jsx';
import Facturas from './components/Facturas/facturas.jsx';
import Productos from './components/catalogo/Productos/Productos.jsx';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/404" element={<FoFPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
          <Route path="/" element={<Navigate to="/Login" />} />
          <Route path="/Login" element={<Login />} />
          <Route path="/dashboardAdmin" element={
            <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
              <DashboardAdmin />
            </RutaProtegida>
          } />
          <Route path="/crear-ticket" element={
            <RutaProtegida>
              <CrearTicket />
            </RutaProtegida>
          } />
          <Route path="/tickets" element={
            <RutaProtegida>
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
            path="/productos"
            element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Productos />
              </RutaProtegida>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;