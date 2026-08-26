import { Router } from 'express';
import { getAll,  create, buscar  } from '../controllers/factura.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';


const router = Router();

router.get('/buscar', verificarToken, buscar);
router.get('/', verificarToken, getAll);
router.post('/',    verificarToken, verificarRol('admin'), create)

export default router;
