import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth.routes.js';
import asignacionRoutes from './routes/asignacion.routes.js';
import categoriaRoutes from './routes/categoria.routes.js';
import departamentoRoutes from './routes/departamento.routes.js';
import compraRoutes from './routes/compra.routes.js';
import empresaRoutes from './routes/empresa.routes.js';
import facturaRoutes from './routes/factura.routes.js';
import inventarioRoutes from './routes/inventario.routes.js';
import pedidoRoutes from './routes/pedido.routes.js';
import productoRoutes from './routes/producto.routes.js';
import proveedorRoutes from './routes/proveedor.routes.js';
import ticketRoutes from './routes/ticket.routes.js'

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', sistema: 'SICAT' });
});

app.use('/api/auth', authRoutes);
app.use('/api/asignaciones', asignacionRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/departamentos', departamentoRoutes);
app.use('/api/compras', compraRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/facturas', facturaRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/tickets', ticketRoutes);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.listen(PORT, () => {
  console.log(`SICAT backend corriendo en http://localhost:${PORT}`);
});