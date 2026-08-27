import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import Login from './components/Login/Login.jsx';
import FoFPage from './components/404Page/ErrorSVG.jsx';
import DashboardAdmin from './components/DashboardAdmin/DashboardAdmin.jsx';
import CrearTicket from './components/Ticket/CrearTicket.jsx';
import Tickets from './components/Ticket/VerTicket/Tickets.jsx';
import VerEmpresa from './components/Empresa/VerEmpresa/VerEmpresa.jsx';

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
          <Route path="/empresa" element={
            <RutaProtegida>
              <VerEmpresa />
            </RutaProtegida>
          } />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;