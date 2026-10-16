import { Router } from 'express';
import { login, me, registrar, logout } from '../controllers/auth.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

const router = Router();
router.post('/login',     login);
router.get ('/me',        verificarToken, me);
router.post('/registrar', verificarToken, verificarRol('admin'), registrar);
router.post('/logout',    verificarToken, logout);
export default router;