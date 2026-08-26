import pool from '../db/pool.js';

export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT pm.*, d.nombre AS departamento, pr.nombre AS producto,
             e.nombre AS empresa
      FROM PEDIDO_MATERIAL pm
      JOIN DEPARTAMENTO d  ON pm.id_departamento = d.id_departamento
      JOIN PRODUCTO     pr ON pm.id_producto      = pr.id_producto
      JOIN EMPRESA       e ON d.id_empresa        = e.id_empresa
      ORDER BY pm.urgente DESC, pm.fecha_solicitud DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  const { id_departamento, id_producto, stock_actual, stock_deseado, urgente } = req.body;
  if (!id_departamento || !id_producto || stock_actual == null || !stock_deseado)
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO PEDIDO_MATERIAL
        (id_departamento, id_producto, stock_actual, stock_deseado, urgente)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id_departamento, id_producto, stock_actual, stock_deseado, urgente ?? false]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function atender(req, res) {
  try {
    const { rows } = await pool.query(`
      UPDATE PEDIDO_MATERIAL SET estatus = 'ENTREGADO'
      WHERE id_pedido = $1 RETURNING *
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}