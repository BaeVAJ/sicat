# SICAT — Stack existente

## Runtime y build

- Node.js con módulos ES (`"type": "module"` en ambos paquetes).
- Frontend: Vite `^8.2.2`, React `^19.2.8`, React DOM `^19.2.8`.
- Backend: Express `^5.2.1`, ejecutado con `node src/index.js`; desarrollo con `node --watch`.
- Gestor de paquetes: pnpm, evidenciado por `pnpm-lock.yaml` y `.pnpm`.
- Frontend no declara una versión mínima de Node mediante `engines`.

## Frontend

- React Router DOM `^7.18.2`.
- Axios `^1.19.0` para llamadas autenticadas con cookies.
- Tailwind CSS `^4.3.3` y plugin Vite `@tailwindcss/vite ^4.3.3` instalados; la mayoría de la UI usa CSS local.
- ESLint `^10.9.0`, `eslint-plugin-react-hooks ^7.1.1`, `eslint-plugin-react-refresh ^0.5.4`.
- Configuración de build en `vite.config.js`; entrada HTML en `index.html`.

## Backend

- `pg ^8.23.0` contra PostgreSQL, configurado por variables `DB_*` y SSL sin verificación de certificado.
- `@supabase/supabase-js ^2.112.4` para almacenamiento de archivos.
- `jsonwebtoken ^9.0.3`, `bcryptjs ^3.0.3` para JWT y contraseñas.
- `cors ^2.8.6`, `cookie ^0.7.2`, `cookie-parser ^1.4.7` para sesión HTTP/CORS.
- `multer ^2.3.0` para cargas multipart en facturas.
- `pdf-lib ^1.17.1` para operaciones relacionadas con PDF.
- `dotenv ^17.4.2` para configuración.

## Persistencia y configuración

- PostgreSQL con tablas relacionales y tipos enum definidos en `sicat-database/database.sql`.
- Supabase actúa como PostgreSQL administrado y como Storage para archivos de facturas/complementos.
- Frontend requiere `VITE_API_URL`.
- Backend requiere `PORT`, `FRONTEND_URL`, `JWT_SECRET`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SUPABASE_URL` y las claves de Storage usadas por `supabaseStorage.js`.
- CORS permite localhost, el dominio de producción `sicat.22670030.workers.dev` y previews de Cloudflare Workers.

## Scripts relevantes

- Frontend: `dev`, `build`, `lint`, `preview`.
- Backend: `dev`, `start`, `migrate:tickets`, `migrate:material`, `migrate:complementos`, `migrate:ppd`, `migrate:factura-estado`.
