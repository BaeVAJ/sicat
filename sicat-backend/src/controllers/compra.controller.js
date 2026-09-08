import pool from '../db/pool.js';

export async function getAll(req, res) {
  try {
    const { sin_factura } = req.query;
    let query = `
      SELECT c.*, p.nombre AS proveedor, e.nombre AS empresa,
             (f.id_compra IS NOT NULL) AS tiene_factura
      FROM COMPRA c
      JOIN PROVEEDOR p ON c.id_proveedor = p.id_proveedor
      JOIN EMPRESA   e ON c.id_empresa   = e.id_empresa
      LEFT JOIN (
        SELECT DISTINCT id_compra FROM FACTURA WHERE id_compra IS NOT NULL
      ) f ON c.id_compra = f.id_compra
    `;
    const params = [];

    if (sin_factura === 'true' || sin_factura === '1') {
      query += ` WHERE f.id_compra IS NULL`;
    }

    query += ` ORDER BY c.fecha_compra DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getById(req, res) {
  try {
    const { rows: [compra] } = await pool.query(
      `SELECT c.*, p.nombre AS proveedor, e.nombre AS empresa
       FROM COMPRA c
       JOIN PROVEEDOR p ON c.id_proveedor = p.id_proveedor
       JOIN EMPRESA   e ON c.id_empresa   = e.id_empresa
       WHERE c.id_compra = $1`, [req.params.id]
    );
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });

    const { rows: detalle } = await pool.query(
      `SELECT dc.*, pr.nombre, pr.marca, pr.modelo
       FROM DETALLE_COMPRA dc
       JOIN PRODUCTO pr ON dc.id_producto = pr.id_producto
       WHERE dc.id_compra = $1`, [req.params.id]
    );
    res.json({ ...compra, detalle });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// detalle: [{ id_producto, cantidad, precio_unitario, id_departamento }]
export async function create(req, res) {
  const { id_proveedor, id_empresa, fecha_compra, detalle } = req.body;
  if (!detalle?.length) return res.status(400).json({ error: 'El detalle es requerido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = detalle.reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);

    const { rows: [compra] } = await client.query(
      `INSERT INTO COMPRA (id_proveedor, id_empresa, fecha_compra, total)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id_proveedor, id_empresa, fecha_compra || new Date(), total.toFixed(2)]
    );

    for (const d of detalle) {
      await client.query(
        `INSERT INTO DETALLE_COMPRA (id_compra, id_producto, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4)`,
        [compra.id_compra, d.id_producto, d.cantidad, d.precio_unitario]
      );
      // Verificar si ya existe en inventario para ese producto y departamento
      const { rows: invExistente } = await client.query(
        `SELECT id_inventario, cantidad_disponible 
         FROM INVENTARIO 
         WHERE id_producto = $1 AND (
           (id_departamento = $2) OR ($2::int IS NULL AND id_departamento IS NULL)
         )`,
        [d.id_producto, d.id_departamento || null]
      );

      if (invExistente.length > 0) {
        await client.query(
          `UPDATE INVENTARIO 
           SET cantidad_disponible = cantidad_disponible + $1 
           WHERE id_inventario = $2`,
          [d.cantidad, invExistente[0].id_inventario]
        );
      } else {
        await client.query(
          `INSERT INTO INVENTARIO (id_producto, id_departamento, cantidad_disponible, cantidad_minima)
           VALUES ($1, $2, $3, 1)`,
          [d.id_producto, d.id_departamento || null, d.cantidad]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...compra, detalle });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
}