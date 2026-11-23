import { Router } from 'express';
import {
  getAll,
  getById,
  create,
  update,
  remove,
  revocarSesiones,
} from '../controllers/usuario.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

const router = Router();

// Ver usuarios: admin y gerente
router.get('/', verificarToken, verificarRol('admin', 'gerente'), getAll);
router.get('/:id', verificarToken, verificarRol('admin', 'gerente'), getById);

// Modificar usuarios: únicamente admin
router.post('/', verificarToken, verificarRol('admin'), create);
router.post('/:id/revocar-sesiones', verificarToken, verificarRol('admin'), revocarSesiones);
router.put('/:id', verificarToken, verificarRol('admin'), update);
router.delete('/:id', verificarToken, verificarRol('admin'), remove);

export default router;
