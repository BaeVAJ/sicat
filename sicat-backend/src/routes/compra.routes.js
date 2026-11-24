import { Router } from 'express';
import { getAll, getById, create, update, remove } from '../controllers/compra.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

const router = Router();
router.get ('/',    verificarToken, verificarRol('admin', 'gerente'), getAll);
router.get ('/:id', verificarToken, verificarRol('admin', 'gerente'), getById);
router.post('/',    verificarToken, verificarRol('admin', 'gerente'), create);
router.put ('/:id', verificarToken, verificarRol('admin'), update);
router.delete('/:id', verificarToken, verificarRol('admin'), remove);
export default router;
