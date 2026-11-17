import { Router } from 'express';
import { getAll, getById, create, remove } from '../controllers/compra.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

const router = Router();
router.get ('/',    verificarToken, getAll);
router.get ('/:id', verificarToken, getById);
router.post('/',    verificarToken, verificarRol('admin', 'gerente'), create);
router.delete('/:id', verificarToken, verificarRol('admin'), remove);
export default router;