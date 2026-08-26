import { Router } from 'express';
import { getAll, create, atender } from '../controllers/pedido.controller.js';
import { verificarToken } from '../middlewares/auth.middleware.js';


const router = Router();

router.get('/',     verificarToken, getAll);
router.post('/',    verificarToken, create);
router.patch('/:id/atender',    verificarToken, atender);

export default router;