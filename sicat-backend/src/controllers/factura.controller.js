import pool from '../db/pool.js';

export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT f.*, c.fecha_compra, e.nombre AS empresa, p.nombre AS proveedor
      FROM FACTURA f
      JOIN COMPRA    c ON f.id_compra    = c.id_compra
      JOIN EMPRESA   e ON c.id_empresa   = e.id_empresa
      JOIN PROVEEDOR p ON c.id_proveedor = p.id_proveedor
      ORDER BY f.fecha_emision DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /api/facturas/buscar?uuid=&empresa=&rfc=&desde=&hasta=
export async function buscar(req, res) {
  const { uuid, empresa, rfc, desde, hasta } = req.query;
  const conditions = [];
  const vals = [];
  let i = 1;

  if (uuid)    { conditions.push(`f.uuid_fiscal::text ILIKE $${i++}`); vals.push(`%${uuid}%`); }
  if (rfc)     { conditions.push(`(f.rfc_emisor = $${i} OR f.rfc_receptor = $${i++})`); vals.push(rfc); }
  if (empresa) { conditions.push(`e.nombre ILIKE $${i++}`); vals.push(`%${empresa}%`); }
  if (desde)   { conditions.push(`f.fecha_emision >= $${i++}`); vals.push(desde); }
  if (hasta)   { conditions.push(`f.fecha_emision <= $${i++}`); vals.push(hasta); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  try {
    const { rows } = await pool.query(`
      SELECT f.*, e.nombre AS empresa, p.nombre AS proveedor
      FROM FACTURA f
      JOIN COMPRA    c ON f.id_compra    = c.id_compra
      JOIN EMPRESA   e ON c.id_empresa   = e.id_empresa
      JOIN PROVEEDOR p ON c.id_proveedor = p.id_proveedor
      ${where}
      ORDER BY f.fecha_emision DESC
    `, vals);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  const { id_compra, uuid_fiscal, rfc_emisor, rfc_receptor,
          fecha_emision, monto_subtotal, monto_iva,
          metodo_pago, uso_cfdi, archivo_url } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO FACTURA
        (id_compra, uuid_fiscal, rfc_emisor, rfc_receptor,
         fecha_emision, monto_subtotal, monto_iva, metodo_pago, uso_cfdi, archivo_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [id_compra, uuid_fiscal, rfc_emisor, rfc_receptor,
        fecha_emision, monto_subtotal, monto_iva, metodo_pago, uso_cfdi, archivo_url]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}