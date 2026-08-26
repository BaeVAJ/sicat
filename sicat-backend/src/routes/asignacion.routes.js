import { Router } from 'express';
import { getAll, create, devolver } from '../controllers/asignacion.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

const router = Router();
router.get('/',     verificarToken, getAll);
router.post('/',    verificarToken, verificarRol('admin', 'gerente'), create);
router.patch('/:id/devolver',   verificarToken, verificarRol('admin', 'gerente'), devolver);


export default router;