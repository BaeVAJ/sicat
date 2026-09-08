import { Router } from 'express';
import { getAll, getByDepartamento, getAlertas, update, create, remove } from '../controllers/inventario.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

const router = Router();
router.get ('/',              verificarToken, getAll);
router.get ('/alertas',       verificarToken, getAlertas);
router.get ('/departamento/:id', verificarToken, getByDepartamento);
router.post('/',              verificarToken, verificarRol('admin', 'gerente', 'usuario'), create);
router.patch('/:id',          verificarToken, verificarRol('admin', 'gerente', 'usuario'), update);
router.delete('/:id',         verificarToken, verificarRol('admin', 'gerente'), remove);
export default router;