import pool from '../db/pool.js';
import { publish } from '../services/eventBus.js';

// Helper: Verifica si el usuario pertenece al departamento de Sistemas
async function esUsuarioSistemas(id_usuario) {
  if (!id_usuario) return false;
  try {
    const { rows } = await pool.query(`
      SELECT d.nombre AS departamento
      FROM USUARIOS u
      LEFT JOIN DEPARTAMENTO d ON u.id_departamento = d.id_departamento
      WHERE u.id_usuario = $1
    `, [id_usuario]);
    const dep = (rows[0]?.departamento || '').toLowerCase();
    return dep.includes('sistema');
  } catch {
    return false;
  }
}


export async function getAll(req, res) {
  try {
    const rol = req.usuario?.rol;
    const id_usuario = req.usuario?.id_usuario;

    let puedeVerTodos = rol === 'admin' || rol === 'gerente';
    if (!puedeVerTodos && rol === 'usuario') {
      puedeVerTodos = await esUsuarioSistemas(id_usuario);
    }

    let query = `
      SELECT t.*, d.nombre AS departamento, u.nombre AS usuario_nombre, u.correo AS usuario_correo
      FROM TICKETS t
      LEFT JOIN DEPARTAMENTO d ON t.id_departamento = d.id_departamento
      LEFT JOIN USUARIOS u ON t.id_usuario = u.id_usuario
    `;
    const params = [];

    if (!puedeVerTodos) {
      query += ` WHERE t.id_usuario = $1`;
      params.push(id_usuario);
    }

    query += ` ORDER BY t.fecha_creacion DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /api/tickets
// A menos que sea administrador, el departamento se asigna automáticamente al de la cuenta creadora.
// Si es administrador, puede crear tickets para otros departamentos.
export async function create(req, res) {
  const { id_departamento, descripcion, urgente } = req.body;
  const id_usuario = req.usuario?.id_usuario || req.body.id_usuario || null;
  const rol = req.usuario?.rol;
  const esUrgente = Boolean(urgente);

  if (!descripcion || descripcion.trim().length < 10) {
    return res.status(400).json({ error: 'La descripción debe tener al menos 10 caracteres' });
  }

  try {
    let depAsignado = null;

    if (rol === 'admin') {
      // El administrador puede elegir cualquier departamento, o usar el suyo por defecto
      if (id_departamento) {
        depAsignado = Number(id_departamento);
      } else {
        const { rows: uRows } = await pool.query(
          `SELECT id_departamento FROM USUARIOS WHERE id_usuario = $1`,
          [id_usuario]
        );
        depAsignado = uRows[0]?.id_departamento || null;
      }
    } else {
      // NO es administrador: se fuerza automáticamente el departamento de la cuenta
      const { rows: uRows } = await pool.query(
        `SELECT id_departamento FROM USUARIOS WHERE id_usuario = $1`,
        [id_usuario]
      );
      depAsignado = uRows[0]?.id_departamento || null;
    }

    if (!depAsignado) {
      return res.status(400).json({
        error: rol === 'admin'
          ? 'Debes seleccionar un departamento para crear el ticket'
          : 'Tu cuenta no tiene un departamento asignado para registrar tickets. Contacta al administrador.'
      });
    }

    const { rows } = await pool.query(`
      INSERT INTO TICKETS (id_departamento, descripcion, id_usuario, urgente)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [depAsignado, descripcion.trim(), id_usuario, esUrgente]);

    publish('ticket.created', rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}


export async function actualizarEstado(req, res) {
  const rol = req.usuario?.rol;
  const id_usuario = req.usuario?.id_usuario;

  let puedeModificar = rol === 'admin' || rol === 'gerente';
  if (!puedeModificar && rol === 'usuario') {
    puedeModificar = await esUsuarioSistemas(id_usuario);
  }

  if (!puedeModificar) {
    return res.status(403).json({
      error: 'Solo administradores, gerentes o personal de sistemas pueden modificar el estado del ticket'
    });
  }

  const { estado, fecha_solucion } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE TICKETS
      SET estado = $1, fecha_solucion = COALESCE($2, fecha_solucion)
      WHERE id_ticket = $3 RETURNING *
    `, [estado, fecha_solucion || null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ticket no encontrado' });
    publish('ticket.updated', rows[0]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}