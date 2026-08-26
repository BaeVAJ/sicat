import pool from '../db/pool.js';

export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT i.*, pr.nombre AS producto, pr.marca, pr.modelo,
             d.nombre AS departamento, e.nombre AS empresa
      FROM INVENTARIO i
      JOIN PRODUCTO     pr ON i.id_producto     = pr.id_producto
      JOIN DEPARTAMENTO d  ON i.id_departamento = d.id_departamento
      JOIN EMPRESA       e ON d.id_empresa      = e.id_empresa
      ORDER BY e.nombre, d.nombre, pr.nombre
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getByDepartamento(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT i.*, pr.nombre AS producto, pr.marca, pr.modelo
      FROM INVENTARIO i
      JOIN PRODUCTO pr ON i.id_producto = pr.id_producto
      WHERE i.id_departamento = $1
      ORDER BY pr.nombre
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getAlertas(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT i.*, pr.nombre AS producto, d.nombre AS departamento
      FROM INVENTARIO i
      JOIN PRODUCTO     pr ON i.id_producto     = pr.id_producto
      JOIN DEPARTAMENTO d  ON i.id_departamento = d.id_departamento
      WHERE i.cantidad_disponible <= i.cantidad_minima
      ORDER BY i.cantidad_disponible ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function update(req, res) {
  const { cantidad_disponible, cantidad_minima } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE INVENTARIO
      SET cantidad_disponible = COALESCE($1, cantidad_disponible),
          cantidad_minima     = COALESCE($2, cantidad_minima)
      WHERE id_inventario = $3
      RETURNING *
    `, [cantidad_disponible, cantidad_minima, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Inventario no encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}