import pool from '../db/pool.js';

export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, d.nombre AS departamento
      FROM TICKETS t
      JOIN DEPARTAMENTO d ON t.id_departamento = d.id_departamento
      ORDER BY t.fecha_creacion DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  const { id_departamento, descripcion } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO TICKETS (id_departamento, descripcion)
      VALUES ($1, $2) RETURNING *
    `, [id_departamento, descripcion]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function actualizarEstado(req, res) {
  const { estado, fecha_solucion } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE TICKETS
      SET estado = $1, fecha_solucion = COALESCE($2, fecha_solucion)
      WHERE id_ticket = $3 RETURNING *
    `, [estado, fecha_solucion || null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}