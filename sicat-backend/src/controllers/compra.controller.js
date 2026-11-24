import pool from '../db/pool.js';
import { enviarErrorInterno, esEnteroPositivo, esEnteroNoNegativo } from '../utils/errorHandler.js';

const MAX_SMALLINT = 32767;

function validarYNormalizarCompra(body) {
  const { id_proveedor, id_empresa, fecha_compra, detalle } = body || {};

  if (!esEnteroPositivo(id_proveedor)) {
    return { error: 'El proveedor es obligatorio y debe ser válido' };
  }
  if (!esEnteroPositivo(id_empresa)) {
    return { error: 'La empresa es obligatoria y debe ser válida' };
  }

  let fechaNormalizada = null;
  if (fecha_compra !== undefined && fecha_compra !== null && String(fecha_compra).trim() !== '') {
    const fechaStr = String(fecha_compra).trim();
    if (Number.isNaN(new Date(fechaStr).getTime())) {
      return { error: 'La fecha de compra no es válida' };
    }
    fechaNormalizada = fechaStr;
  }

  if (!Array.isArray(detalle) || detalle.length === 0) {
    return { error: 'El detalle es requerido' };
  }

  const detalleNormalizado = [];
  for (const item of detalle) {
    if (!item || !esEnteroPositivo(item.id_producto)) {
      return { error: 'Cada línea debe incluir un producto válido' };
    }
    if (!esEnteroPositivo(item.cantidad)) {
      return { error: 'La cantidad debe ser un entero positivo' };
    }

    const cantidadNum = Number(item.cantidad);
    const precio = Number(item.precio_unitario);
    if (
      item.precio_unitario === '' ||
      item.precio_unitario == null ||
      typeof item.precio_unitario === 'boolean' ||
      !Number.isFinite(precio) ||
      precio < 0
    ) {
      return { error: 'El precio unitario debe ser un número mayor o igual a 0' };
    }

    if (item.id_departamento != null && !esEnteroPositivo(item.id_departamento)) {
      return { error: 'El departamento de cada línea debe ser válido' };
    }

    let recibidosNum = null;
    if (item.recibidos !== undefined && item.recibidos !== null && item.recibidos !== '') {
      if (!esEnteroNoNegativo(item.recibidos)) {
        return { error: 'La cantidad recibida debe ser un entero mayor o igual a 0' };
      }
      recibidosNum = Number(item.recibidos);
      if (recibidosNum > cantidadNum) {
        return { error: 'La cantidad recibida no puede superar la cantidad comprada' };
      }
      if (recibidosNum > MAX_SMALLINT) {
        return { error: 'La cantidad recibida excede el límite permitido' };
      }
    }

    detalleNormalizado.push({
      id_producto: Number(item.id_producto),
      cantidad: cantidadNum,
      precio_unitario: precio,
      id_departamento: item.id_departamento != null ? Number(item.id_departamento) : null,
      recibidos: recibidosNum,
    });
  }

  return {
    data: {
      id_proveedor: Number(id_proveedor),
      id_empresa: Number(id_empresa),
      fecha_compra: fechaNormalizada,
      detalle: detalleNormalizado,
    },
  };
}

function acumularDelta(mapa, idProducto, idDepartamento, diff) {
  const prodId = Number(idProducto);
  const deptoId = idDepartamento == null ? null : Number(idDepartamento);
  const key = `${prodId}:${deptoId ?? 'null'}`;
  const actual = mapa.get(key) || {
    id_producto: prodId,
    id_departamento: deptoId,
    delta: 0,
  };
  actual.delta += Number(diff);
  mapa.set(key, actual);
}

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
  if (!esEnteroPositivo(req.params.id)) {
    return res.status(400).json({ error: 'ID de compra inválido' });
  }

  try {
    const { rows: [compra] } = await pool.query(
      `SELECT c.*, p.nombre AS proveedor, e.nombre AS empresa, d.nombre AS departamento
       FROM COMPRA c
       JOIN PROVEEDOR p ON c.id_proveedor = p.id_proveedor
       JOIN EMPRESA   e ON c.id_empresa   = e.id_empresa
       LEFT JOIN DETALLE_COMPRA dc ON c.id_compra = dc.id_compra
       LEFT JOIN DEPARTAMENTO d ON dc.id_departamento = d.id_departamento
       WHERE c.id_compra = $1
       LIMIT 1`,
      [req.params.id]
    );
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });

    const { rows: detalle } = await pool.query(
      `SELECT dc.*, pr.nombre, pr.marca, pr.modelo
       FROM DETALLE_COMPRA dc
       JOIN PRODUCTO pr ON dc.id_producto = pr.id_producto
       WHERE dc.id_compra = $1`,
      [req.params.id]
    );
    res.json({ ...compra, detalle });
  } catch (err) { return enviarErrorInterno(res, err, 'compra.getById'); }
}

// detalle: [{ id_producto, cantidad, precio_unitario, id_departamento, recibidos }]
export async function create(req, res) {
  const { error, data } = validarYNormalizarCompra(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const departamentoUsuario = Number(req.usuario?.id_departamento);
  const esSistemas = departamentoUsuario === 1;
  if (!esSistemas && data.detalle.some((item) => Number(item.id_departamento) !== departamentoUsuario)) {
    return res.status(403).json({
      error: 'Solo puedes registrar productos para el inventario de tu departamento'
    });
  }

  const { id_proveedor, id_empresa, fecha_compra, detalle: detalleNormalizado } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = detalleNormalizado.reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);

    const { rows: [compra] } = await client.query(
      `INSERT INTO COMPRA (id_proveedor, id_empresa, fecha_compra, total)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id_proveedor, id_empresa, fecha_compra || new Date(), total.toFixed(2)]
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

export async function update(req, res) {
  if (!esEnteroPositivo(req.params.id)) {
    return res.status(400).json({ error: 'ID de compra inválido' });
  }

  const { error, data } = validarYNormalizarCompra(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const idCompra = Number(req.params.id);
  const { id_proveedor, id_empresa, fecha_compra, detalle: detalleNormalizado } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [compraActual] } = await client.query(
      `SELECT * FROM COMPRA WHERE id_compra = $1 FOR UPDATE`,
      [idCompra]
    );
    if (!compraActual) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    const { rows: detalleAnterior } = await client.query(
      `SELECT id_producto, id_departamento, cantidad FROM DETALLE_COMPRA WHERE id_compra = $1`,
      [idCompra]
    );

    const deltas = new Map();
    for (const oldLine of detalleAnterior) {
      acumularDelta(deltas, oldLine.id_producto, oldLine.id_departamento, -Number(oldLine.cantidad));
    }
    for (const newLine of detalleNormalizado) {
      acumularDelta(deltas, newLine.id_producto, newLine.id_departamento, newLine.cantidad);
    }

    const ajustes = Array.from(deltas.values())
      .filter((entry) => entry.delta !== 0)
      .sort(
        (a, b) =>
          (a.id_producto - b.id_producto) ||
          ((a.id_departamento ?? -1) - (b.id_departamento ?? -1))
      );

    for (const entry of ajustes) {
      const { rows: invRows } = await client.query(
        `SELECT id_inventario, cantidad_disponible
         FROM INVENTARIO
         WHERE id_producto = $1 AND (
           (id_departamento = $2) OR ($2::int IS NULL AND id_departamento IS NULL)
         )
         FOR UPDATE`,
        [entry.id_producto, entry.id_departamento]
      );

      if (entry.delta < 0) {
        if (!invRows[0] || Number(invRows[0].cantidad_disponible) + entry.delta < 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'No se puede reducir o quitar uno de los productos porque el inventario disponible es menor al ajuste requerido.',
          });
        }
        await client.query(
          `UPDATE INVENTARIO SET cantidad_disponible = cantidad_disponible + $1 WHERE id_inventario = $2`,
          [entry.delta, invRows[0].id_inventario]
        );
      } else if (invRows[0]) {
        await client.query(
          `UPDATE INVENTARIO SET cantidad_disponible = cantidad_disponible + $1 WHERE id_inventario = $2`,
          [entry.delta, invRows[0].id_inventario]
        );
      } else {
        await client.query(
          `INSERT INTO INVENTARIO (id_producto, id_departamento, cantidad_disponible, cantidad_minima)
           VALUES ($1, $2, $3, 1)`,
          [entry.id_producto, entry.id_departamento, entry.delta]
        );
      }
    }

    const total = detalleNormalizado.reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);
    const fechaFinal = fecha_compra || compraActual.fecha_compra;

    const { rows: [compraActualizada] } = await client.query(
      `UPDATE COMPRA
       SET id_proveedor = $1, id_empresa = $2, fecha_compra = $3, total = $4
       WHERE id_compra = $5
       RETURNING *`,
      [id_proveedor, id_empresa, fechaFinal, total.toFixed(2), idCompra]
    );

    await client.query(`DELETE FROM DETALLE_COMPRA WHERE id_compra = $1`, [idCompra]);
    for (const d of detalleNormalizado) {
      await client.query(
        `INSERT INTO DETALLE_COMPRA (id_compra, id_producto, cantidad, precio_unitario, id_departamento, recibidos)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [idCompra, d.id_producto, d.cantidad, d.precio_unitario, d.id_departamento, d.recibidos]
      );
    }

    await client.query('COMMIT');
    res.json({ ...compraActualizada, detalle: detalleNormalizado });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return enviarErrorInterno(res, err, 'compra.update');
  } finally {
    client.release();
  }
}

export async function remove(req, res) {
  if (!esEnteroPositivo(req.params.id)) {
    return res.status(400).json({ error: 'ID de compra inválido' });
  }

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
