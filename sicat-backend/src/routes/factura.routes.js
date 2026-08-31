import { Router } from 'express';
import multer from 'multer';
import { getAll, create, buscar, eliminar, getUrlPdf } from '../controllers/factura.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

// Configurar multer para almacenar el archivo en memoria (máx 20MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  },
});

const router = Router();

router.get('/buscar', verificarToken, buscar);
router.get('/:id/url', verificarToken, getUrlPdf);
router.get('/', verificarToken, getAll);
router.post('/', verificarToken, verificarRol('admin'), upload.single('archivo'), create);
router.delete('/:id', verificarToken, verificarRol('admin'), eliminar);

export default router;
