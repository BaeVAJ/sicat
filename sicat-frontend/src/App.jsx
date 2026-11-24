import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';

import Login from './components/Login/Login.jsx';
import FoFPage from './components/404Page/ErrorSVG.jsx';

const Inicio = lazy(() => import('./components/inicio/Inicio.jsx'));
const CrearTicket = lazy(() => import('./components/Ticket/CrearTicket/CrearTicket.jsx'));
const Tickets = lazy(() => import('./components/Ticket/VerTicket/Tickets.jsx'));
const VerEmpresa = lazy(() => import('./components/Organizacion/Empresa/Empresa.jsx'));
const Departamento = lazy(() => import('./components/Organizacion/Departamento/Departamento.jsx'));
const Facturas = lazy(() => import('./components/Facturas/facturas.jsx'));
const Productos = lazy(() => import('./components/catalogo/Productos/Productos.jsx'));
const Categorias = lazy(() => import('./components/catalogo/Categorias/Categorias.jsx'));
const Proveedores = lazy(() => import('./components/catalogo/Proveedores/Proveedores.jsx'));
const Usuarios = lazy(() => import('./components/Usuarios/Usuarios.jsx'));
const Compras = lazy(() => import('./components/Operaciones/Compras/Compras.jsx'));
const Inventario = lazy(() => import('./components/Operaciones/Inventario/Inventario.jsx'));
const Asignaciones = lazy(() => import('./components/Operaciones/Asignaciones/Asignaciones.jsx'));
const SolicitarMaterial = lazy(() => import('./components/Operaciones/SolicitarMaterial/SolicitarMaterial.jsx'));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div>Cargando página...</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/Login" replace />} />
            <Route path="/Login" element={<Login />} />
            <Route path="/404" element={<FoFPage />} />

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
            <Route path="/empresas" element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <VerEmpresa />
              </RutaProtegida>
            } />
            <Route path="/departamentos" element={
              <RutaProtegida rolesPermitidos={['admin']}>
                <Departamento />
              </RutaProtegida>
            } />
            <Route path="/facturas" element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Facturas />
              </RutaProtegida>
            } />
            <Route path="/categorias" element={
              <RutaProtegida rolesPermitidos={['admin']}>
                <Categorias />
              </RutaProtegida>
            } />
            <Route path="/productos" element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Productos />
              </RutaProtegida>
            } />
            <Route path="/proveedores" element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Proveedores />
              </RutaProtegida>
            } />
            <Route path="/usuarios" element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Usuarios />
              </RutaProtegida>
            } />
            <Route path="/compras" element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Compras />
              </RutaProtegida>
            } />
            <Route path="/inventario" element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente', 'usuario']}>
                <Inventario />
              </RutaProtegida>
            } />
            <Route path="/solicitar-material" element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente', 'usuario']}>
                <SolicitarMaterial />
              </RutaProtegida>
            } />
            <Route path="/asignaciones" element={
              <RutaProtegida rolesPermitidos={['admin', 'gerente']}>
                <Asignaciones />
              </RutaProtegida>
            } />

            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;