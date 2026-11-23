import { Router } from 'express';
import multer from 'multer';
import {
  getAll, create, update, buscar, eliminar, getUrlPdf,
  getComplementos, getComplementosByFactura, createComplementoPago,
  updateComplementoPago, getUrlComplemento, deleteComplementoPago, getFormasPago,
  getEstadoCuentaPpd, getSiguientePago,
  reemplazarDocumentoFactura, eliminarDocumentoFactura,
  reemplazarDocumentoComplemento, eliminarDocumentoComplemento,
} from '../controllers/factura.controller.js';
import { verificarToken, verificarRol } from '../middlewares/auth.middleware.js';

// Configurar multer para almacenar archivos en memoria (máx 25MB por archivo)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    const original = (file.originalname || '').toLowerCase();
    const mimetype = (file.mimetype || '').toLowerCase();

    const isPdf = original.endsWith('.pdf') && mimetype === 'application/pdf';
    const isXml =
      original.endsWith('.xml') &&
      (mimetype === 'text/xml' || mimetype === 'application/xml');

    let valido = false;
    if (file.fieldname === 'archivo_pdf') {
      valido = isPdf;
    } else if (file.fieldname === 'archivo_xml') {
      valido = isXml;
    } else if (file.fieldname === 'archivo') {
      valido = isPdf || isXml;
    }

    if (valido) {
      cb(null, true);
    } else {
      const err = new Error('Solo se permiten archivos válidos en formato PDF (.pdf) o XML (.xml)');
      err.status = 400;
      cb(err, false);
    }
  },
});

const uploadDocs = upload.fields([
  { name: 'archivo_pdf', maxCount: 1 },
  { name: 'archivo_xml', maxCount: 1 },
  { name: 'archivo', maxCount: 1 },
]);

const router = Router();

router.get('/buscar', verificarToken, verificarRol('admin', 'gerente'), buscar);
router.get('/ppd/estado-cuenta', verificarToken, verificarRol('admin', 'gerente'), getEstadoCuentaPpd);
router.get('/formas-pago', verificarToken, verificarRol('admin', 'gerente'), getFormasPago);
router.get('/complementos', verificarToken, verificarRol('admin', 'gerente'), getComplementos);
router.get('/complementos/:id/url', verificarToken, verificarRol('admin', 'gerente'), getUrlComplemento);
router.get('/:id/complementos/siguiente', verificarToken, verificarRol('admin', 'gerente'), getSiguientePago);
router.get('/:id/complementos', verificarToken, verificarRol('admin', 'gerente'), getComplementosByFactura);
router.get('/:id/url', verificarToken, verificarRol('admin', 'gerente'), getUrlPdf);
router.get('/', verificarToken, verificarRol('admin', 'gerente'), getAll);

// Acepta archivo_pdf, archivo_xml y archivo (retrocompatibilidad)
router.post('/', verificarToken, verificarRol('admin'), uploadDocs, create);
router.post('/:id/complementos', verificarToken, verificarRol('admin'), uploadDocs, createComplementoPago);

router.patch('/complementos/:id/documento/:tipo', verificarToken, verificarRol('admin'), uploadDocs, reemplazarDocumentoComplemento);
router.delete('/complementos/:id/documento/:tipo', verificarToken, verificarRol('admin'), eliminarDocumentoComplemento);
router.put('/complementos/:id', verificarToken, verificarRol('admin'), uploadDocs, updateComplementoPago);

router.patch('/:id/documento/:tipo', verificarToken, verificarRol('admin'), uploadDocs, reemplazarDocumentoFactura);
router.delete('/:id/documento/:tipo', verificarToken, verificarRol('admin'), eliminarDocumentoFactura);
router.put('/:id', verificarToken, verificarRol('admin'), uploadDocs, update);

router.delete('/complementos/:id', verificarToken, verificarRol('admin'), deleteComplementoPago);
router.delete('/:id', verificarToken, verificarRol('admin'), eliminar);

export default router;
