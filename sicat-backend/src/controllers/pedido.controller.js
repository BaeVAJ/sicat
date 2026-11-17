import pool from '../db/pool.js';
import { publish } from '../services/eventBus.js';

export async function getAll(req, res) {
  try {
    const isManager = ['admin', 'gerente'].includes(req.usuario?.rol);
    const { rows } = await pool.query(`
      SELECT pm.*, d.nombre AS departamento, pr.nombre AS producto,
             pr.marca, pr.modelo, c.tipo AS tipo_producto,
             e.nombre AS empresa
      FROM PEDIDO_MATERIAL pm
      JOIN DEPARTAMENTO d  ON pm.id_departamento = d.id_departamento
      LEFT JOIN PRODUCTO pr ON pm.id_producto = pr.id_producto
      LEFT JOIN CATEGORIA c ON pr.id_categoria = c.id_categoria
      JOIN EMPRESA       e ON d.id_empresa        = e.id_empresa
      ${isManager ? '' : `WHERE pm.id_departamento = ${Number(req.usuario?.id_departamento) || 0}`}
      ORDER BY pm.urgente DESC, pm.fecha_solicitud DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  const { id_departamento, descripcion_material, cantidad_solicitada, urgente } = req.body;
  const cantidad = Number(cantidad_solicitada);
  if (!descripcion_material?.trim() || !Number.isInteger(cantidad) || cantidad < 1)
    return res.status(400).json({ error: 'Indica el material y una cantidad válida' });

  try {
    const department = ['admin', 'gerente'].includes(req.usuario?.rol)
      ? Number(id_departamento) || Number(req.usuario?.id_departamento)
      : Number(req.usuario?.id_departamento);

    if (!department) {
      return res.status(400).json({ error: 'No se encontró el departamento del solicitante' });
    }

    const { rows } = await pool.query(`
      INSERT INTO PEDIDO_MATERIAL
        (id_departamento, id_producto, descripcion_material, cantidad_solicitada,
         stock_actual, stock_deseado, urgente)
      VALUES ($1, NULL, $2, $3, 0, $3, $4)
      RETURNING *
    `, [department, descripcion_material.trim(), cantidad, urgente ?? false]);
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