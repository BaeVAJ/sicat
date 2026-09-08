import { Router } from 'express';
import { getAll, getById, create, update, remove } from '../controllers/proveedor.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

const router = Router();
router.get   ('/',    verificarToken, getAll);
router.get   ('/:id', verificarToken, getById);
router.post  ('/',    verificarToken, verificarRol('admin', 'gerente'), create);
router.put   ('/:id', verificarToken, verificarRol('admin', 'gerente'), update);
router.delete('/:id', verificarToken, verificarRol('admin', 'gerente'), remove);

export default router;