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
      SELECT f.*, c.fecha_compra, e.nombre AS empresa, p.nombre AS proveedor, f.estado
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

  // Validación de montos: el total (subtotal + IVA) debe ser mayor a cero.
  const subtotal = monto_subtotal === '' || monto_subtotal == null ? 0 : Number(monto_subtotal);
  const iva = monto_iva === '' || monto_iva == null ? 0 : Number(monto_iva);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return res.status(400).json({ error: 'El subtotal debe ser un número mayor o igual a cero', campo: 'monto_subtotal' });
  }
  if (!Number.isFinite(iva) || iva < 0) {
    return res.status(400).json({ error: 'El IVA debe ser un número mayor o igual a cero', campo: 'monto_iva' });
  }
  const total = Number((subtotal + iva).toFixed(2));
  if (total <= 0) {
    return res.status(400).json({ error: 'El total de la factura debe ser mayor a cero', campo: 'monto_subtotal' });
  }

  // El estado se deriva en el servidor: PUE se paga de contado, PPD inicia PENDIENTE
  // (el trigger recalcula el estado conforme se registren pagos).
  const metodo = metodo_pago || 'PUE';
  const estadoFinal = metodo === 'PUE' ? 'PAGADO' : 'PENDIENTE';

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
         fecha_emision, monto_subtotal, monto_iva, metodo_pago, uso_cfdi, archivo_url, archivo_xml_url, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      Number(id_compra),
      uuid_fiscal,
      rfc_emisor ? rfc_emisor.toUpperCase() : null,
      rfc_receptor ? rfc_receptor.toUpperCase() : null,
      fecha_emision || new Date(),
      subtotal,
      iva,
      metodo,
      uso_cfdi || 'G01',
      archivo_url,
      archivo_xml_url,
      estadoFinal,
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
      total,
      saldo_esperado: metodo === 'PPD' ? total : 0,
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

    const { rows: complementos } = await pool.query(
      'SELECT url_pdf, url_xml FROM DETALLES_FACTURA WHERE id_factura = $1',
      [id]
    );

    // 2. Eliminar de la base de datos
    await pool.query('DELETE FROM DETALLES_FACTURA WHERE id_factura = $1', [id]);
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

    complementos.forEach(({ url_pdf, url_xml }) => {
      [url_pdf, url_xml].filter(Boolean).forEach((path) => {
        eliminarArchivoFactura(path).catch((err) =>
          console.warn('Error eliminando archivo de complemento en Supabase:', err.message)
        );
      });
    });

    res.json({ message: 'Factura y archivos adjuntos eliminados correctamente', id_factura: id });
  } catch (err) {
    console.error('Error al eliminar factura:', err);
    res.status(500).json({ error: err.message || 'Error al eliminar la factura' });
  }
}

// GET /api/facturas/complementos
export async function getComplementos(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT d.*, f.uuid_fiscal, f.metodo_pago, e.nombre AS empresa, p.nombre AS proveedor
      FROM DETALLES_FACTURA d
      JOIN FACTURA f ON f.id_factura = d.id_factura
      JOIN COMPRA c ON c.id_compra = f.id_compra
      JOIN EMPRESA e ON e.id_empresa = c.id_empresa
      JOIN PROVEEDOR p ON p.id_proveedor = c.id_proveedor
      ORDER BY d.fecha_pago DESC, d.id_detalle_factura DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al cargar los complementos de pago' });
  }
}

// GET /api/facturas/:id/complementos
export async function getComplementosByFactura(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, f.uuid_fiscal, f.metodo_pago
       FROM DETALLES_FACTURA d
       JOIN FACTURA f ON f.id_factura = d.id_factura
       WHERE d.id_factura = $1
       ORDER BY d.fecha_pago DESC, d.id_detalle_factura DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al cargar los complementos de pago' });
  }
}

async function validarFacturaPpd(idFactura) {
  const { rows } = await pool.query(
    'SELECT id_factura, metodo_pago FROM FACTURA WHERE id_factura = $1',
    [idFactura]
  );
  if (!rows[0]) {
    const error = new Error('Factura no encontrada');
    error.status = 404;
    throw error;
  }
  if (rows[0].metodo_pago !== 'PPD') {
    const error = new Error('Solo se pueden registrar complementos para facturas con método PPD');
    error.status = 400;
    throw error;
  }
  return rows[0];
}

// GET /api/facturas/ppd/estado-cuenta
// Facturas PPD con su total, pagado, saldo, número de pagos y estado real.
export async function getEstadoCuentaPpd(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        f.id_factura, f.uuid_fiscal, f.metodo_pago, f.estado, f.fecha_emision,
        f.monto_subtotal, f.monto_iva,
        e.nombre AS empresa, p.nombre AS proveedor,
        COALESCE(f.monto_subtotal, 0) + COALESCE(f.monto_iva, 0) AS total,
        COALESCE(SUM(d.monto_pago), 0) AS pagado,
        GREATEST(COALESCE(f.monto_subtotal, 0) + COALESCE(f.monto_iva, 0) - COALESCE(SUM(d.monto_pago), 0), 0) AS saldo,
        COUNT(d.id_detalle_factura)::int AS num_pagos,
        MAX(d.num_pago) AS ultimo_num_pago,
        MAX(d.fecha_pago) AS ultimo_pago
      FROM FACTURA f
      JOIN COMPRA    c ON c.id_compra    = f.id_compra
      JOIN EMPRESA   e ON e.id_empresa   = c.id_empresa
      JOIN PROVEEDOR p ON p.id_proveedor = c.id_proveedor
      LEFT JOIN DETALLES_FACTURA d ON d.id_factura = f.id_factura
      WHERE f.metodo_pago = 'PPD' AND f.estado <> 'CANCELADO'
      GROUP BY f.id_factura, e.nombre, p.nombre
      ORDER BY f.fecha_emision DESC, f.id_factura DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al obtener el estado de cuenta PPD' });
  }
}

// GET /api/facturas/:id/complementos/siguiente
// Datos precargados para registrar el siguiente pago de una factura PPD.
export async function getSiguientePago(req, res) {
  try {
    const idFactura = Number(req.params.id);
    await validarFacturaPpd(idFactura);
    const resumen = await obtenerResumenFacturaPpd(idFactura);
    if (!resumen) return res.status(404).json({ error: 'Factura no encontrada' });

    res.json({
      id_factura: idFactura,
      num_pago: (Number(resumen.ultimo_num_pago) || 0) + 1,
      saldo_anterior: resumen.saldo,
      total: resumen.total,
      pagado: resumen.pagado,
      saldo: resumen.saldo,
      num_pagos: resumen.num_pagos,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error al calcular el siguiente pago' });
  }
}

// GET /api/facturas/formas-pago
export async function getFormasPago(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT codigo_pago, descripcion
      FROM codigo_pago
      ORDER BY codigo_pago ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al obtener las formas de pago' });
  }
}

async function validarFormaPago(formaPagoSeleccionada) {
  if (!formaPagoSeleccionada) {
    const error = new Error('La forma de pago es obligatoria');
    error.status = 400;
    throw error;
  }
  const { rows } = await pool.query(
    `SELECT codigo_pago, descripcion
     FROM codigo_pago
     WHERE codigo_pago = $1 OR descripcion = $1
     LIMIT 1`,
    [formaPagoSeleccionada]
  );
  if (!rows[0]) {
    const error = new Error('La forma de pago seleccionada no es válida');
    error.status = 400;
    throw error;
  }
  return rows[0];
}

function obtenerArchivosComplemento(req) {
  const files = req.files || {};
  return {
    pdfFile: (files.archivo_pdf && files.archivo_pdf[0]) || (files.archivo && files.archivo[0]),
    xmlFile: files.archivo_xml && files.archivo_xml[0],
  };
}

async function subirArchivosComplemento(req, complemento = {}) {
  const { pdfFile, xmlFile } = obtenerArchivosComplemento(req);
  const result = { url_pdf: complemento.url_pdf || null, url_xml: complemento.url_xml || null };

  if (pdfFile) {
    const uploaded = await subirPdfFactura(pdfFile.buffer, pdfFile.originalname);
    result.url_pdf = uploaded.url;
  }
  if (xmlFile) {
    const uploaded = await subirXmlFactura(xmlFile.buffer, xmlFile.originalname);
    result.url_xml = uploaded.url;
  }
  return result;
}

function errorCampo(campo, mensaje, status = 400) {
  const error = new Error(mensaje);
  error.status = status;
  error.campo = campo;
  return error;
}

// Total facturado, pagado (opcionalmente excluyendo un detalle) y saldo disponible
async function calcularSaldoFactura(idFactura, excluirDetalleId = null) {
  const { rows } = await pool.query(`
    SELECT
      COALESCE(f.monto_subtotal, 0) + COALESCE(f.monto_iva, 0) AS total,
      COALESCE((
        SELECT SUM(d.monto_pago)
        FROM DETALLES_FACTURA d
        WHERE d.id_factura = f.id_factura
          AND ($2::int IS NULL OR d.id_detalle_factura <> $2)
      ), 0) AS pagado
    FROM FACTURA f
    WHERE f.id_factura = $1
  `, [idFactura, excluirDetalleId]);

  const total = Number(rows[0]?.total || 0);
  const pagado = Number(rows[0]?.pagado || 0);
  return { total, pagado, saldo: Math.max(total - pagado, 0) };
}

async function validarNumPagoUnico(idFactura, numPago, excluirDetalleId = null) {
  if (numPago == null || numPago === '') return;
  const { rowCount } = await pool.query(
    `SELECT 1 FROM DETALLES_FACTURA
     WHERE id_factura = $1 AND num_pago = $2
       AND ($3::int IS NULL OR id_detalle_factura <> $3)`,
    [idFactura, Number(numPago), excluirDetalleId]
  );
  if (rowCount > 0) {
    throw errorCampo('num_pago', `Ya existe el pago número ${numPago} para esta factura`);
  }
}

// Estado de cuenta consolidado de una factura PPD
export async function obtenerResumenFacturaPpd(idFactura) {
  const { rows } = await pool.query(`
    SELECT
      f.id_factura, f.uuid_fiscal, f.metodo_pago, f.estado, f.fecha_emision,
      f.monto_subtotal, f.monto_iva,
      e.nombre AS empresa, p.nombre AS proveedor,
      COALESCE(f.monto_subtotal, 0) + COALESCE(f.monto_iva, 0) AS total,
      COALESCE(SUM(d.monto_pago), 0) AS pagado,
      GREATEST(COALESCE(f.monto_subtotal, 0) + COALESCE(f.monto_iva, 0) - COALESCE(SUM(d.monto_pago), 0), 0) AS saldo,
      COUNT(d.id_detalle_factura)::int AS num_pagos,
      MAX(d.num_pago) AS ultimo_num_pago,
      MAX(d.fecha_pago) AS ultimo_pago
    FROM FACTURA f
    JOIN COMPRA    c ON c.id_compra    = f.id_compra
    JOIN EMPRESA   e ON e.id_empresa   = c.id_empresa
    JOIN PROVEEDOR p ON p.id_proveedor = c.id_proveedor
    LEFT JOIN DETALLES_FACTURA d ON d.id_factura = f.id_factura
    WHERE f.id_factura = $1
    GROUP BY f.id_factura, e.nombre, p.nombre
  `, [idFactura]);
  return rows[0] || null;
}

// POST /api/facturas/:id/complementos
export async function createComplementoPago(req, res) {
  try {
    const idFactura = Number(req.params.id);
    await validarFacturaPpd(idFactura);

    const { num_pago, fecha_pago, saldo_anterior, monto_pago, forma_pago } = req.body;

    if (!fecha_pago || Number.isNaN(new Date(fecha_pago).getTime())) {
      throw errorCampo('fecha_pago', 'La fecha de pago es obligatoria y debe ser válida');
    }
    const monto = Number(monto_pago);
    if (!monto_pago || Number.isNaN(monto) || monto <= 0) {
      throw errorCampo('monto_pago', 'El monto de pago debe ser mayor a cero');
    }
    const formaPago = await validarFormaPago(forma_pago);
    await validarNumPagoUnico(idFactura, num_pago);

    const { total, saldo } = await calcularSaldoFactura(idFactura);
    if (total > 0 && monto > saldo + 0.005) {
      throw errorCampo('monto_pago', `El monto no puede exceder el saldo pendiente ($${saldo.toFixed(2)})`);
    }

    // El saldo y el faltante se derivan en el servidor; no se confía en el cliente
    const saldoAnterior = total > 0
      ? saldo
      : (saldo_anterior === '' || saldo_anterior == null ? null : Number(saldo_anterior));
    const faltaPagar = saldoAnterior == null ? null : Math.max(saldoAnterior - monto, 0);

    const files = await subirArchivosComplemento(req);
    const { rows } = await pool.query(`
      INSERT INTO DETALLES_FACTURA
        (id_factura, num_pago, codigo_pago, fecha_pago, saldo_anterior, monto_pago, forma_pago, falta_pagar, url_pdf, url_xml)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      idFactura,
      num_pago ? Number(num_pago) : null,
      formaPago.codigo_pago,
      fecha_pago,
      saldoAnterior,
      monto,
      formaPago.descripcion,
      faltaPagar,
      files.url_pdf,
      files.url_xml,
    ]);

    const factura = await obtenerResumenFacturaPpd(idFactura);
    res.status(201).json({ ...rows[0], factura });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe ese número de pago para la factura', campo: 'num_pago' });
    }
    console.error('Error al crear complemento de pago:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Error al crear el complemento de pago',
      ...(err.campo ? { campo: err.campo } : {}),
    });
  }
}

// PUT /api/facturas/complementos/:id
export async function updateComplementoPago(req, res) {
  const id = Number(req.params.id);
  try {
    const { rows: currentRows } = await pool.query(
      'SELECT * FROM DETALLES_FACTURA WHERE id_detalle_factura = $1',
      [id]
    );
    if (!currentRows[0]) return res.status(404).json({ error: 'Complemento de pago no encontrado' });
    const idFactura = currentRows[0].id_factura;
    await validarFacturaPpd(idFactura);

    const { num_pago, fecha_pago, saldo_anterior, monto_pago, forma_pago } = req.body;

    if (!fecha_pago || Number.isNaN(new Date(fecha_pago).getTime())) {
      throw errorCampo('fecha_pago', 'La fecha de pago es obligatoria y debe ser válida');
    }
    const monto = Number(monto_pago);
    if (!monto_pago || Number.isNaN(monto) || monto <= 0) {
      throw errorCampo('monto_pago', 'El monto de pago debe ser mayor a cero');
    }
    const formaPago = await validarFormaPago(forma_pago);
    await validarNumPagoUnico(idFactura, num_pago, id);

    const { total, saldo } = await calcularSaldoFactura(idFactura, id);
    if (total > 0 && monto > saldo + 0.005) {
      throw errorCampo('monto_pago', `El monto no puede exceder el saldo pendiente ($${saldo.toFixed(2)})`);
    }

    const saldoAnterior = total > 0
      ? saldo
      : (saldo_anterior === '' || saldo_anterior == null ? null : Number(saldo_anterior));
    const faltaPagar = saldoAnterior == null ? null : Math.max(saldoAnterior - monto, 0);

    const uploaded = await subirArchivosComplemento(req, currentRows[0]);
    const { rows } = await pool.query(`
      UPDATE DETALLES_FACTURA
      SET num_pago = $1, codigo_pago = $2, fecha_pago = $3, saldo_anterior = $4,
          monto_pago = $5, forma_pago = $6, falta_pagar = $7, url_pdf = $8, url_xml = $9
      WHERE id_detalle_factura = $10
      RETURNING *
    `, [
      num_pago ? Number(num_pago) : null,
      formaPago.codigo_pago,
      fecha_pago,
      saldoAnterior,
      monto,
      formaPago.descripcion,
      faltaPagar,
      uploaded.url_pdf,
      uploaded.url_xml,
      id,
    ]);

    [currentRows[0].url_pdf, currentRows[0].url_xml].filter((oldPath) => oldPath &&
      oldPath !== uploaded.url_pdf && oldPath !== uploaded.url_xml
    ).forEach((oldPath) => eliminarArchivoFactura(oldPath));

    const factura = await obtenerResumenFacturaPpd(idFactura);
    res.json({ ...rows[0], factura });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe ese número de pago para la factura', campo: 'num_pago' });
    }
    console.error('Error al actualizar complemento de pago:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Error al actualizar el complemento de pago',
      ...(err.campo ? { campo: err.campo } : {}),
    });
  }
}

// GET /api/facturas/complementos/:id/url?tipo=pdf|xml
export async function getUrlComplemento(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM DETALLES_FACTURA WHERE id_detalle_factura = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Complemento de pago no encontrado' });
    const pdfUrl = rows[0].url_pdf ? await obtenerUrlFirmada(rows[0].url_pdf, 3600) : null;
    const xmlUrl = rows[0].url_xml ? await obtenerUrlFirmada(rows[0].url_xml, 3600) : null;
    res.json({
      url: req.query.tipo === 'xml' ? xmlUrl || pdfUrl : pdfUrl || xmlUrl,
      pdf_url: pdfUrl,
      xml_url: xmlUrl,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al generar el enlace del complemento' });
  }
}

// DELETE /api/facturas/complementos/:id
export async function deleteComplementoPago(req, res) {
  try {
    const { rows } = await pool.query(
      'DELETE FROM DETALLES_FACTURA WHERE id_detalle_factura = $1 RETURNING url_pdf, url_xml',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Complemento de pago no encontrado' });
    [rows[0].url_pdf, rows[0].url_xml].filter(Boolean).forEach((path) => eliminarArchivoFactura(path));
    res.json({ message: 'Complemento de pago eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al eliminar el complemento de pago' });
  }
}
