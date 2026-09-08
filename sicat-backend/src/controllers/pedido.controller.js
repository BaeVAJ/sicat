import pool from '../db/pool.js';
import { publish } from '../services/eventBus.js';

export async function getAll(req, res) {
  try {
    const isManager = ['admin', 'gerente'].includes(req.usuario?.rol);
    const { rows } = await pool.query(`
      SELECT pm.*, d.nombre AS departamento, pr.nombre AS producto,
             e.nombre AS empresa
      FROM PEDIDO_MATERIAL pm
      JOIN DEPARTAMENTO d  ON pm.id_departamento = d.id_departamento
      JOIN PRODUCTO     pr ON pm.id_producto      = pr.id_producto
      JOIN EMPRESA       e ON d.id_empresa        = e.id_empresa
      ${isManager ? '' : `WHERE pm.id_departamento = ${Number(req.usuario?.id_departamento) || 0}`}
      ORDER BY pm.urgente DESC, pm.fecha_solicitud DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  const { id_departamento, id_producto, stock_actual, stock_deseado, urgente, para_sistemas } = req.body;
  if (!id_producto || stock_actual == null || !stock_deseado)
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  if (para_sistemas && String(req.usuario?.departamento || '').toLowerCase().includes('sistema')) {
    return res.status(403).json({ error: 'El departamento de Sistemas no puede solicitar material a sí mismo' });
  }

  try {
    let department;
    if (para_sistemas) {
      const { rows: systemsDepartments } = await pool.query(`
        SELECT id_departamento
        FROM DEPARTAMENTO
        WHERE LOWER(nombre) LIKE '%sistema%'
        ORDER BY id_departamento
        LIMIT 1
      `);
      department = systemsDepartments[0]?.id_departamento;
    } else {
      department = ['admin', 'gerente'].includes(req.usuario?.rol)
        ? Number(id_departamento)
        : Number(req.usuario?.id_departamento);
    }

    if (!department) {
      return res.status(400).json({ error: 'No se encontró el departamento de Sistemas' });
    }

    const { rows } = await pool.query(`
      INSERT INTO PEDIDO_MATERIAL
        (id_departamento, id_producto, stock_actual, stock_deseado, urgente)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [department, id_producto, stock_actual, stock_deseado, urgente ?? false]);
    publish('material-request.created', rows[0]);
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
    publish('material-request.updated', rows[0]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}