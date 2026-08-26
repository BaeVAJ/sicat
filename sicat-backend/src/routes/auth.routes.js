import { Router } from 'express';
import { login, me, registrar } from '../controllers/auth.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

const router = Router();
router.post('/login',     login);
router.get ('/me',        verificarToken, me);
router.post('/registrar', verificarToken, verificarRol('admin'), registrar);
export default router;