import { Router } from 'express';
import { getAll, create, actualizarEstado, actualizarDescripcion } from '../controllers/ticket.controller.js';
import { verificarToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.get ('/', verificarToken, getAll);
router.post('/', verificarToken, create);
router.patch('/:id/estado', verificarToken, actualizarEstado);
router.patch('/:id/descripcion', verificarToken, actualizarDescripcion);

export default router;