import pool from '../db/pool.js';
import { publish } from '../services/eventBus.js';

export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, pr.nombre AS producto, pr.marca,
             d.nombre AS departamento,
             dorig.nombre AS departamento_origen
      FROM ASIGNACION a
      JOIN INVENTARIO        i     ON a.id_inventario      = i.id_inventario
      JOIN PRODUCTO          pr    ON i.id_producto         = pr.id_producto
      JOIN DEPARTAMENTO      d     ON a.id_departamento     = d.id_departamento
      LEFT JOIN DEPARTAMENTO dorig ON i.id_departamento     = dorig.id_departamento
      ORDER BY a.fecha_asignacion DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  const { id_inventario, id_departamento, condicion } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener registro del inventario de origen
    const { rows: [inv] } = await client.query(
      'SELECT * FROM INVENTARIO WHERE id_inventario = $1', [id_inventario]
    );
    if (!inv) throw new Error('Inventario de origen no encontrado');
    if (inv.cantidad_disponible < 1) throw new Error('Sin stock disponible en el inventario de origen');

    // 2. Descontar 1 del inventario de origen
    await client.query(
      'UPDATE INVENTARIO SET cantidad_disponible = cantidad_disponible - 1 WHERE id_inventario = $1',
      [id_inventario]
    );

    // 3. Sumar 1 al inventario del departamento que recibe la asignación (préstamo)
    const destDeptoId = Number(id_departamento);
    const { rows: destInv } = await client.query(
      'SELECT id_inventario FROM INVENTARIO WHERE id_producto = $1 AND id_departamento = $2',
      [inv.id_producto, destDeptoId]
    );

    if (destInv.length > 0) {
      await client.query(
        'UPDATE INVENTARIO SET cantidad_disponible = cantidad_disponible + 1 WHERE id_inventario = $1',
        [destInv[0].id_inventario]
      );
    } else {
      await client.query(
        `INSERT INTO INVENTARIO (id_producto, id_departamento, cantidad_disponible, cantidad_minima)
         VALUES ($1, $2, 1, 1)`,
        [inv.id_producto, destDeptoId]
      );
    }

    // 4. Registrar la asignación
    const { rows: [asig] } = await client.query(`
      INSERT INTO ASIGNACION (id_inventario, id_departamento, condicion, estatus)
      VALUES ($1, $2, $3, 'ACTIVO') RETURNING *
    `, [id_inventario, destDeptoId, condicion || null]);

    await client.query('COMMIT');
    publish('assignment.created', asig);
    res.status(201).json(asig);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
}

export async function devolver(req, res) {
  const { condicion } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [asig] } = await client.query(`
      SELECT a.*, i.id_producto, i.id_departamento AS id_departamento_origen
      FROM ASIGNACION a
      JOIN INVENTARIO i ON a.id_inventario = i.id_inventario
      WHERE a.id_asignacion = $1
    `, [req.params.id]);

    if (!asig) throw new Error('Asignación no encontrada');
    if (asig.estatus === 'DEVUELTO') throw new Error('Ya fue devuelta');

    // 1. Marcar como devuelto
    await client.query(`
      UPDATE ASIGNACION
      SET estatus = 'DEVUELTO', fecha_devolucion = CURRENT_DATE,
          condicion = COALESCE($1, condicion)
      WHERE id_asignacion = $2
    `, [condicion, req.params.id]);

    // 2. Descontar del departamento prestatario (y eliminar la fila si su stock llega a 0)
    const { rows: destInv } = await client.query(
      'SELECT id_inventario, cantidad_disponible FROM INVENTARIO WHERE id_producto = $1 AND id_departamento = $2',
      [asig.id_producto, asig.id_departamento]
    );

    if (destInv.length > 0 && destInv[0].id_inventario !== asig.id_inventario) {
      const remainingStock = (destInv[0].cantidad_disponible || 0) - 1;

      if (remainingStock <= 0) {
        // Verificar si está referenciado como origen en alguna otra asignación
        const { rows: refs } = await client.query(
          'SELECT 1 FROM ASIGNACION WHERE id_inventario = $1 LIMIT 1',
          [destInv[0].id_inventario]
        );

        if (refs.length === 0) {
          // Se elimina la fila del inventario del departamento prestatario
          await client.query(
            'DELETE FROM INVENTARIO WHERE id_inventario = $1',
            [destInv[0].id_inventario]
          );
        } else {
          await client.query(
            'UPDATE INVENTARIO SET cantidad_disponible = 0 WHERE id_inventario = $1',
            [destInv[0].id_inventario]
          );
        }
      } else {
        await client.query(
          'UPDATE INVENTARIO SET cantidad_disponible = $1 WHERE id_inventario = $2',
          [remainingStock, destInv[0].id_inventario]
        );
      }
    }

    // 3. Regresar 1 al inventario de origen
    await client.query(
      'UPDATE INVENTARIO SET cantidad_disponible = cantidad_disponible + 1 WHERE id_inventario = $1',
      [asig.id_inventario]
    );

    await client.query('COMMIT');
    publish('assignment.returned', { id_asignacion: req.params.id });
    res.json({ mensaje: 'Devolución registrada correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
}