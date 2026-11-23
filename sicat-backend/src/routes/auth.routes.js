import { Router } from 'express';
import {
  login,
  me,
  registrar,
  logout,
  logoutAll,
  sesiones,
} from '../controllers/auth.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';
import { loginRateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

router.post('/login', loginRateLimiter, login);
router.get('/me', verificarToken, me);
router.get('/sesiones', verificarToken, sesiones);
router.post('/registrar', verificarToken, verificarRol('admin'), registrar);
router.post('/logout', logout);
router.post('/logout-all', verificarToken, logoutAll);

export default router;
