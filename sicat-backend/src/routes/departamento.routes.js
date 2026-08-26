import { Router } from 'express';
import { getAll, getById, create, update, remove } from '../controllers/departamento.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

const router = Router();
router.get   ('/',    verificarToken, getAll);
router.get   ('/:id', verificarToken, getById);
router.post  ('/',    verificarToken, verificarRol('admin'), create);
router.put   ('/:id', verificarToken, verificarRol('admin'), update);
router.delete('/:id', verificarToken, verificarRol('admin'), remove);
export default router;