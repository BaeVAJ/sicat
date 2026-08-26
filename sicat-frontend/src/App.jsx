import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import Login from './components/Login/Login.jsx';
import FoFPage   from './components/404Page/ErrorSVG.jsx';
/* import Dashboard from './components/Dashboard/Dashboard.jsx';
import Ticket    from './components/Tickets/Tickets.jsx';*/

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/404"   element={<FoFPage />} />
          <Route path="*"      element={<Navigate to="/404" replace />} />
          <Route path="/"      element={<Navigate to="/Login"/>} />  
          <Route path="/Login" element={<Login />} />
          {/*
          
          <Route path="/crear-ticket" element={
            <RutaProtegida><Ticket /></RutaProtegida>
          } />
          <Route path="/dashboard" element={
            <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
              <Dashboard />
            </RutaProtegida>
          } />*/}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;