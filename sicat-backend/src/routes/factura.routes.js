import { Router } from 'express';
import multer from 'multer';
import { getAll, create, buscar, eliminar, getUrlPdf } from '../controllers/factura.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

// Configurar multer para almacenar archivos en memoria (máx 25MB por archivo)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
  fileFilter: (req, file, cb) => {
    const original = (file.originalname || '').toLowerCase();
    const mimetype = (file.mimetype || '').toLowerCase();

    const isPdf = mimetype === 'application/pdf' || original.endsWith('.pdf');
    const isXml =
      mimetype === 'text/xml' ||
      mimetype === 'application/xml' ||
      original.endsWith('.xml');

    if (isPdf || isXml) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos en formato PDF (.pdf) o XML (.xml)'), false);
    }
  },
});

const router = Router();

router.get('/buscar', verificarToken, buscar);
router.get('/:id/url', verificarToken, getUrlPdf);
router.get('/', verificarToken, getAll);

// Acepta archivo_pdf, archivo_xml y archivo (retrocompatibilidad)
router.post(
  '/',
  verificarToken,
  verificarRol('admin'),
  upload.fields([
    { name: 'archivo_pdf', maxCount: 1 },
    { name: 'archivo_xml', maxCount: 1 },
    { name: 'archivo', maxCount: 1 },
  ]),
  create
);

router.delete('/:id', verificarToken, verificarRol('admin'), eliminar);

export default router;
