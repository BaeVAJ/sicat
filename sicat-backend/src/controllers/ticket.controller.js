import pool from '../db/pool.js';

export async function getAll(req, res) {
  try {
    const rol = req.usuario?.rol;
    const id_usuario = req.usuario?.id_usuario;

    let query = `
      SELECT t.*, d.nombre AS departamento, u.nombre AS usuario_nombre, u.correo AS usuario_correo
      FROM TICKETS t
      LEFT JOIN DEPARTAMENTO d ON t.id_departamento = d.id_departamento
      LEFT JOIN USUARIOS u ON t.id_usuario = u.id_usuario
    `;
    const params = [];

    if (rol === 'usuario') {
      query += ` WHERE t.id_usuario = $1`;
      params.push(id_usuario);
    }

    query += ` ORDER BY t.fecha_creacion DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  const { id_departamento, descripcion, urgente } = req.body;
  const id_usuario = req.usuario?.id_usuario || req.body.id_usuario || null;
  const esUrgente = Boolean(urgente);
  try {
    const { rows } = await pool.query(`
      INSERT INTO TICKETS (id_departamento, descripcion, id_usuario, urgente)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [id_departamento, descripcion, id_usuario, esUrgente]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function actualizarEstado(req, res) {
  if (req.usuario?.rol === 'usuario') {
    return res.status(403).json({ error: 'No tienes permisos para cambiar el estado del ticket' });
  }
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