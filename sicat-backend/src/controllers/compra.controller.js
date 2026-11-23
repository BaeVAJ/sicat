import pool from '../db/pool.js';
import { enviarErrorInterno, esEnteroPositivo, esEnteroNoNegativo } from '../utils/errorHandler.js';

export async function getAll(req, res) {
  try {
    const { sin_factura } = req.query;
    let query = `
      SELECT c.*, p.nombre AS proveedor, e.nombre AS empresa,
             (f.id_compra IS NOT NULL) AS tiene_factura,
             (
               SELECT STRING_AGG(DISTINCT d.nombre, ', ' ORDER BY d.nombre)
               FROM DETALLE_COMPRA dc
               JOIN DEPARTAMENTO d ON dc.id_departamento = d.id_departamento
               WHERE dc.id_compra = c.id_compra
             ) AS departamento
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
  } catch (err) { return enviarErrorInterno(res, err, 'compra.getAll'); }
}

export async function getById(req, res) {
  try {
    const { rows: [compra] } = await pool.query(
      `SELECT c.*, p.nombre AS proveedor, e.nombre AS empresa, d.nombre as departamento
       FROM COMPRA c
       JOIN PROVEEDOR p ON c.id_proveedor = p.id_proveedor
       JOIN EMPRESA   e ON c.id_empresa   = e.id_empresa
       JOIN DETALLE_COMPRA dc ON c.id_compra = dc.id_compra
       JOIN DEPARTAMENTO d on dc.id_departamento = d.id_departamento
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
  } catch (err) { return enviarErrorInterno(res, err, 'compra.getById'); }
}

// detalle: [{ id_producto, cantidad, precio_unitario, id_departamento }]
export async function create(req, res) {
  const { id_proveedor, id_empresa, fecha_compra, detalle } = req.body || {};
  if (!esEnteroPositivo(id_proveedor)) {
    return res.status(400).json({ error: 'El proveedor es obligatorio y debe ser válido' });
  }
  if (!esEnteroPositivo(id_empresa)) {
    return res.status(400).json({ error: 'La empresa es obligatoria y debe ser válida' });
  }
  if (!Array.isArray(detalle) || detalle.length === 0) {
    return res.status(400).json({ error: 'El detalle es requerido' });
  }

  for (const item of detalle) {
    if (!item || !esEnteroPositivo(item.id_producto)) {
      return res.status(400).json({ error: 'Cada línea debe incluir un producto válido' });
    }
    if (!esEnteroPositivo(item.cantidad)) {
      return res.status(400).json({ error: 'La cantidad debe ser un entero positivo' });
    }
    const precio = Number(item.precio_unitario);
    if (
      item.precio_unitario === '' ||
      item.precio_unitario == null ||
      typeof item.precio_unitario === 'boolean' ||
      !Number.isFinite(precio) ||
      precio < 0
    ) {
      return res.status(400).json({ error: 'El precio unitario debe ser un número mayor o igual a 0' });
    }
    if (item.id_departamento != null && !esEnteroPositivo(item.id_departamento)) {
      return res.status(400).json({ error: 'El departamento de cada línea debe ser válido' });
    }
    if (item.recibidos != null && !esEnteroNoNegativo(item.recibidos)) {
      return res.status(400).json({ error: 'La cantidad recibida debe ser un entero mayor o igual a 0' });
    }
  }

  const departamentoUsuario = Number(req.usuario?.id_departamento);
  const esSistemas = departamentoUsuario === 1;
  if (!esSistemas && detalle.some((item) => Number(item.id_departamento) !== departamentoUsuario)) {
    return res.status(403).json({
      error: 'Solo puedes registrar productos para el inventario de tu departamento'
    });
  }

  const detalleNormalizado = detalle.map((d) => ({
    id_producto: Number(d.id_producto),
    cantidad: Number(d.cantidad),
    precio_unitario: Number(d.precio_unitario),
    id_departamento: d.id_departamento != null ? Number(d.id_departamento) : null,
    recibidos: d.recibidos == null ? null : Number(d.recibidos),
  }));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = detalleNormalizado.reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);

    const { rows: [compra] } = await client.query(
      `INSERT INTO COMPRA (id_proveedor, id_empresa, fecha_compra, total)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [Number(id_proveedor), Number(id_empresa), fecha_compra || new Date(), total.toFixed(2)]
    );

    for (const d of detalleNormalizado) {
      await client.query(
        `INSERT INTO DETALLE_COMPRA (id_compra, id_producto, cantidad, precio_unitario, id_departamento, recibidos)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [compra.id_compra, d.id_producto, d.cantidad, d.precio_unitario, d.id_departamento, d.recibidos]
      );
      // Verificar si ya existe en inventario para ese producto y departamento
      const { rows: invExistente } = await client.query(
        `SELECT id_inventario, cantidad_disponible 
         FROM INVENTARIO 
         WHERE id_producto = $1 AND (
           (id_departamento = $2) OR ($2::int IS NULL AND id_departamento IS NULL)
         )`,
        [d.id_producto, d.id_departamento]
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
          [d.id_producto, d.id_departamento, d.cantidad]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...compra, detalle: detalleNormalizado });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return enviarErrorInterno(res, err, 'compra.create');
  } finally { client.release(); }
}

export async function remove(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id_producto, id_departamento, cantidad FROM DETALLE_COMPRA WHERE id_compra = $1`,
      [req.params.id]
    );
    if (!rows || rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    for (const d of rows) {
      await client.query(
        `UPDATE INVENTARIO SET cantidad_disponible = cantidad_disponible - $1 WHERE id_producto = $2 AND id_departamento = $3`,
        [d.cantidad, d.id_producto, d.id_departamento]
      );
    }

    await client.query(`DELETE FROM DETALLE_COMPRA WHERE id_compra = $1`, [req.params.id]);
    await client.query(`DELETE FROM COMPRA WHERE id_compra = $1 RETURNING *`, [req.params.id]);

    await client.query('COMMIT');
    res.json({ mensaje: 'Compra eliminada correctamente' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return enviarErrorInterno(res, err, 'compra.remove');
  } finally {
    client.release();
  }
}