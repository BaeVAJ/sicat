import pool from '../db/pool.js';
import {
  subirPdfFactura,
  subirXmlFactura,
  eliminarArchivoFactura,
  obtenerUrlFirmada,
} from '../services/supabaseStorage.js';

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

// GET /api/facturas/:id/url?tipo=pdf|xml -> Genera URLs firmadas seguras bajo demanda
export async function getUrlPdf(req, res) {
  const { id } = req.params;
  const { tipo } = req.query; // 'pdf' o 'xml'
  try {
    const { rows } = await pool.query(
      'SELECT id_factura, archivo_url, archivo_xml_url, uuid_fiscal FROM FACTURA WHERE id_factura = $1',
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    const { archivo_url, archivo_xml_url, uuid_fiscal } = rows[0];

    if (!archivo_url && !archivo_xml_url) {
      return res.status(404).json({ error: 'La factura no tiene archivos asociados' });
    }

    let pdfSignedUrl = null;
    let xmlSignedUrl = null;

    if (archivo_url) {
      try {
        pdfSignedUrl = await obtenerUrlFirmada(archivo_url, 3600);
      } catch (e) {
        console.warn('Error firmando URL de PDF:', e.message);
      }
    }

    if (archivo_xml_url) {
      try {
        xmlSignedUrl = await obtenerUrlFirmada(archivo_xml_url, 3600);
      } catch (e) {
        console.warn('Error firmando URL de XML:', e.message);
      }
    }

    // Si pide específicamente XML o PDF
    const primaryUrl = tipo === 'xml' ? xmlSignedUrl || pdfSignedUrl : pdfSignedUrl || xmlSignedUrl;

    res.json({
      url: primaryUrl,
      pdf_url: pdfSignedUrl,
      xml_url: xmlSignedUrl,
      id_factura: id,
      uuid_fiscal,
    });
  } catch (err) {
    console.error('Error al generar URL firmada de factura:', err);
    res.status(500).json({ error: err.message || 'Error al obtener acceso a los archivos' });
  }
}

// POST /api/facturas (soporta PDF, XML o ambos mediante multipart/form-data)
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
  let archivo_xml_url = req.body.archivo_xml_url || null;
  let compressionStats = null;

  try {
    // Archivos adjuntos en req.files
    const files = req.files || {};
    const pdfFile = (files.archivo_pdf && files.archivo_pdf[0]) || (files.archivo && files.archivo[0]);
    const xmlFile = files.archivo_xml && files.archivo_xml[0];

    // 1. Subir PDF si se proporcionó
    if (pdfFile) {
      const uploadPdfResult = await subirPdfFactura(pdfFile.buffer, pdfFile.originalname);
      archivo_url = uploadPdfResult.url;
      compressionStats = {
        originalSize: uploadPdfResult.originalSize,
        compressedSize: uploadPdfResult.compressedSize,
      };
    }

    // 2. Subir XML si se proporcionó
    if (xmlFile) {
      const uploadXmlResult = await subirXmlFactura(xmlFile.buffer, xmlFile.originalname);
      archivo_xml_url = uploadXmlResult.url;
    }

    // 3. Insertar registro en la base de datos
    const { rows } = await pool.query(`
      INSERT INTO FACTURA
        (id_compra, uuid_fiscal, rfc_emisor, rfc_receptor,
         fecha_emision, monto_subtotal, monto_iva, metodo_pago, uso_cfdi, archivo_url, archivo_xml_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      archivo_xml_url,
    ]);

    // 4. Obtener la factura con las relaciones cargadas
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
    // 1. Obtener los archivos asociados antes de eliminar
    const { rows } = await pool.query(
      'SELECT id_factura, archivo_url, archivo_xml_url FROM FACTURA WHERE id_factura = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    const { archivo_url, archivo_xml_url } = rows[0];

    // 2. Eliminar de la base de datos
    await pool.query('DELETE FROM FACTURA WHERE id_factura = $1', [id]);

    // 3. Eliminar archivos de Supabase Storage en segundo plano
    if (archivo_url) {
      eliminarArchivoFactura(archivo_url).catch((err) =>
        console.warn('Error eliminando PDF en Supabase:', err.message)
      );
    }

    if (archivo_xml_url) {
      eliminarArchivoFactura(archivo_xml_url).catch((err) =>
        console.warn('Error eliminando XML en Supabase:', err.message)
      );
    }

    res.json({ message: 'Factura y archivos adjuntos eliminados correctamente', id_factura: id });
  } catch (err) {
    console.error('Error al eliminar factura:', err);
    res.status(500).json({ error: err.message || 'Error al eliminar la factura' });
  }
}