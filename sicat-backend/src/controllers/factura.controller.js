import pool from '../db/pool.js';
import { subirPdfFactura, eliminarPdfFactura, obtenerUrlFirmada } from '../services/supabaseStorage.js';

// GET /api/facturas
export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT f.*, c.fecha_compra, e.nombre AS empresa, p.nombre AS proveedor
      FROM FACTURA f
      JOIN COMPRA    c ON f.id_compra    = c.id_compra
      JOIN EMPRESA   e ON c.id_empresa   = e.id_empresa
      JOIN PROVEEDOR p ON c.id_proveedor = p.id_proveedor
      ORDER BY f.fecha_emision DESC, f.id_factura DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/facturas/buscar?uuid=&empresa=&rfc=&desde=&hasta=
export async function buscar(req, res) {
  const { uuid, empresa, rfc, desde, hasta } = req.query;
  const conditions = [];
  const vals = [];
  let i = 1;

  if (uuid)    { conditions.push(`f.uuid_fiscal::text ILIKE $${i++}`); vals.push(`%${uuid}%`); }
  if (rfc)     { conditions.push(`(f.rfc_emisor ILIKE $${i} OR f.rfc_receptor ILIKE $${i++})`); vals.push(`%${rfc}%`); }
  if (empresa) { conditions.push(`e.nombre ILIKE $${i++}`); vals.push(`%${empresa}%`); }
  if (desde)   { conditions.push(`f.fecha_emision >= $${i++}`); vals.push(desde); }
  if (hasta)   { conditions.push(`f.fecha_emision <= $${i++}`); vals.push(hasta); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  try {
    const { rows } = await pool.query(`
      SELECT f.*, c.fecha_compra, e.nombre AS empresa, p.nombre AS proveedor
      FROM FACTURA f
      JOIN COMPRA    c ON f.id_compra    = c.id_compra
      JOIN EMPRESA   e ON c.id_empresa   = e.id_empresa
      JOIN PROVEEDOR p ON c.id_proveedor = p.id_proveedor
      ${where}
      ORDER BY f.fecha_emision DESC, f.id_factura DESC
    `, vals);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/facturas/:id/url -> Genera URL firmada segura bajo demanda para ver el PDF
export async function getUrlPdf(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT id_factura, archivo_url, uuid_fiscal FROM FACTURA WHERE id_factura = $1', [id]);
    if (!rows[0] || !rows[0].archivo_url) {
      return res.status(404).json({ error: 'La factura no tiene un archivo PDF asociado' });
    }

    const signedUrl = await obtenerUrlFirmada(rows[0].archivo_url, 3600); // 1 hora de validez
    res.json({ url: signedUrl, id_factura: id, uuid_fiscal: rows[0].uuid_fiscal });
  } catch (err) {
    console.error('Error al generar URL firmada de factura:', err);
    res.status(500).json({ error: err.message || 'Error al obtener acceso al PDF' });
  }
}

// POST /api/facturas (soporta JSON o multipart/form-data con archivo PDF)
export async function create(req, res) {
  const {
    id_compra,
    uuid_fiscal,
    rfc_emisor,
    rfc_receptor,
    fecha_emision,
    monto_subtotal,
    monto_iva,
    metodo_pago,
    uso_cfdi,
  } = req.body;

  let archivo_url = req.body.archivo_url || null;
  let compressionStats = null;

  try {
    // Si viene un archivo adjunto mediante Multer en req.file
    if (req.file) {
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'Solo se permiten archivos en formato PDF' });
      }

      const uploadResult = await subirPdfFactura(req.file.buffer, req.file.originalname);
      archivo_url = uploadResult.url;
      compressionStats = {
        originalSize: uploadResult.originalSize,
        compressedSize: uploadResult.compressedSize,
      };
    }

    const { rows } = await pool.query(`
      INSERT INTO FACTURA
        (id_compra, uuid_fiscal, rfc_emisor, rfc_receptor,
         fecha_emision, monto_subtotal, monto_iva, metodo_pago, uso_cfdi, archivo_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      Number(id_compra),
      uuid_fiscal,
      rfc_emisor ? rfc_emisor.toUpperCase() : null,
      rfc_receptor ? rfc_receptor.toUpperCase() : null,
      fecha_emision || new Date(),
      monto_subtotal ? Number(monto_subtotal) : 0,
      monto_iva ? Number(monto_iva) : 0,
      metodo_pago || 'PUE',
      uso_cfdi || 'G01',
      archivo_url,
    ]);

    // Obtener la factura con las relaciones cargadas
    const { rows: enriched } = await pool.query(`
      SELECT f.*, c.fecha_compra, e.nombre AS empresa, p.nombre AS proveedor
      FROM FACTURA f
      JOIN COMPRA    c ON f.id_compra    = c.id_compra
      JOIN EMPRESA   e ON c.id_empresa   = e.id_empresa
      JOIN PROVEEDOR p ON c.id_proveedor = p.id_proveedor
      WHERE f.id_factura = $1
    `, [rows[0].id_factura]);

    res.status(201).json({
      ...(enriched[0] || rows[0]),
      compressionStats,
    });
  } catch (err) {
    console.error('Error al registrar factura:', err);
    res.status(500).json({ error: err.message || 'Error al registrar la factura' });
  }
}

// DELETE /api/facturas/:id
export async function eliminar(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM FACTURA WHERE id_factura = $1', [id]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    const factura = rows[0];

    // Eliminar registro de la base de datos
    await pool.query('DELETE FROM FACTURA WHERE id_factura = $1', [id]);

    // Eliminar archivo de Supabase Storage en segundo plano
    if (factura.archivo_url) {
      eliminarPdfFactura(factura.archivo_url).catch((e) =>
        console.warn('Error al eliminar PDF de Supabase Storage:', e)
      );
    }

    res.json({ mensaje: 'Factura eliminada exitosamente', id_factura: id });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al eliminar la factura' });
  }
}