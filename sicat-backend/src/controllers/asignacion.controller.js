import pool from '../db/pool.js';

export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, pr.nombre AS producto, pr.marca,
             d.nombre AS departamento
      FROM ASIGNACION a
      JOIN INVENTARIO   i  ON a.id_inventario  = i.id_inventario
      JOIN PRODUCTO     pr ON i.id_producto     = pr.id_producto
      JOIN DEPARTAMENTO d  ON a.id_departamento = d.id_departamento
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

    const { rows: [inv] } = await client.query(
      'SELECT * FROM INVENTARIO WHERE id_inventario = $1', [id_inventario]
    );
    if (!inv) throw new Error('Inventario no encontrado');
    if (inv.cantidad_disponible < 1) throw new Error('Sin stock disponible');

    await client.query(
      'UPDATE INVENTARIO SET cantidad_disponible = cantidad_disponible - 1 WHERE id_inventario = $1',
      [id_inventario]
    );
    const { rows: [asig] } = await client.query(`
      INSERT INTO ASIGNACION (id_inventario, id_departamento, condicion, estatus)
      VALUES ($1, $2, $3, 'ACTIVO') RETURNING *
    `, [id_inventario, id_departamento, condicion || null]);

    await client.query('COMMIT');
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

    const { rows: [asig] } = await client.query(
      'SELECT * FROM ASIGNACION WHERE id_asignacion = $1', [req.params.id]
    );
    if (!asig) throw new Error('Asignación no encontrada');
    if (asig.estatus === 'DEVUELTO') throw new Error('Ya fue devuelta');

    await client.query(`
      UPDATE ASIGNACION
      SET estatus = 'DEVUELTO', fecha_devolucion = CURRENT_DATE,
          condicion = COALESCE($1, condicion)
      WHERE id_asignacion = $2
    `, [condicion, req.params.id]);

    await client.query(
      'UPDATE INVENTARIO SET cantidad_disponible = cantidad_disponible + 1 WHERE id_inventario = $1',
      [asig.id_inventario]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'Devolución registrada correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
}