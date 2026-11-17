# SICAT — Estructura del proyecto

## Clasificación

SICAT es una aplicación **full-stack** compuesta por:

- `sicat-frontend`: SPA React servida y construida con Vite.
- `sicat-backend`: API HTTP Express ejecutada como proceso Node.js.
- `sicat-database`: scripts SQL PostgreSQL y semillas.
- `Doc`: documentación funcional externa (`Documentacion_Integral_SICAT.docx`).

`node_modules`, `dist` y archivos de IDE son artefactos de desarrollo y no forman parte de la arquitectura funcional.

## Flujo de ejecución

1. `sicat-frontend/index.html` carga `src/main.jsx`.
2. `src/main.jsx` monta `App`.
3. `App.jsx` crea el `AuthProvider`, registra las rutas React Router y aplica `RutaProtegida` a las pantallas privadas.
4. Las pantallas llaman a `src/api/client.js`, que apunta a `VITE_API_URL` y conserva cookies (`withCredentials`).
5. `sicat-backend/src/index.js` inicializa dotenv, CORS, JSON, cookies, rutas `/api/*` y el stream SSE de eventos.
6. Los controladores ejecutan SQL parametrizado a través de `src/db/pool.js`; facturas y complementos usan además Supabase Storage.
7. PostgreSQL aplica claves foráneas, enums, restricciones y algunos cambios de esquema ejecutados por migraciones.

## Capas

### Frontend

- Entrada y composición: `src/main.jsx`, `src/App.jsx`.
- Autenticación y sesión: `src/context/AuthContext.jsx`, `src/components/RutaProtegida.jsx`.
- Transporte: `src/api/client.js`, `src/api/events.js`.
- Layout transversal: `src/components/layout/`.
- Pantallas funcionales: `src/components/` agrupadas en Login, Inicio, Tickets, Facturas, Catálogo, Organización, Usuarios y Operaciones.
- Estilos: CSS junto a cada componente, más `App.css` e `index.css`.

### Backend

- Entrada/configuración HTTP: `src/index.js`.
- Rutas: `src/routes/*.routes.js`.
- Autorización: `src/middlewares/auth.middleware.js`.
- Casos de uso y SQL: `src/controllers/*.controller.js`.
- Persistencia: `src/db/pool.js` y migraciones `src/db/migrate_*.js`.
- Integraciones/transporte: `src/services/eventBus.js`, `src/services/supabaseStorage.js`.

## Áreas funcionales

1. **Identidad y autorización**: login, logout, sesión actual, registro y roles `admin`, `gerente`, `usuario`.
2. **Organización**: empresas y departamentos.
3. **Catálogo**: categorías, productos y proveedores.
4. **Abastecimiento**: compras y detalle de compras.
5. **Facturación**: CFDI, archivos PDF/XML, complementos de pago, formas de pago y estado de cuenta PPD.
6. **Inventario**: existencias por producto/departamento, mínimos y alertas.
7. **Solicitudes y asignaciones**: pedidos de material, asignaciones, devoluciones y atención de pedidos.
8. **Mesa de ayuda**: tickets, estados y fechas límite.
9. **Notificaciones**: eventos internos publicados por el backend y entregados por SSE a usuarios del área de sistemas.

## Entradas externas

- SPA: `/Login`, `/Inicio`, `/tickets`, `/crear-ticket`, `/empresas`, `/departamentos`, `/facturas`, `/complementos-pago`, `/estado-cuenta-ppd`, `/categorias`, `/productos`, `/proveedores`, `/usuarios`, `/compras`, `/inventario`, `/solicitar-material`, `/asignaciones`.
- API: grupos `/api/auth`, `/api/asignaciones`, `/api/categorias`, `/api/departamentos`, `/api/compras`, `/api/empresas`, `/api/facturas`, `/api/inventario`, `/api/pedidos`, `/api/productos`, `/api/proveedores`, `/api/tickets`, `/api/usuarios`.
- Health check: `GET /api/health`.
- Eventos: `GET /api/events/stream` con Server-Sent Events.
