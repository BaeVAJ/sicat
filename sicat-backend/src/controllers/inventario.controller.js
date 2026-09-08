import pool from '../db/pool.js';
import { publish } from '../services/eventBus.js';

export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT i.*, pr.nombre AS producto, pr.marca, pr.modelo,
             d.nombre AS departamento, e.nombre AS empresa
      FROM INVENTARIO i
      JOIN PRODUCTO     pr ON i.id_producto     = pr.id_producto
      JOIN DEPARTAMENTO d  ON i.id_departamento = d.id_departamento
      JOIN EMPRESA       e ON d.id_empresa      = e.id_empresa
      ${req.usuario?.rol === 'admin' || req.usuario?.rol === 'gerente' ? '' : `WHERE i.id_departamento = ${Number(req.usuario?.id_departamento) || 0}`}
      ORDER BY e.nombre, d.nombre, pr.nombre
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getByDepartamento(req, res) {
  try {
    if (!['admin', 'gerente'].includes(req.usuario?.rol) &&
        Number(req.params.id) !== Number(req.usuario?.id_departamento)) {
      return res.status(403).json({ error: 'Solo puedes consultar el inventario de tu departamento' });
    }
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
    const isManager = ['admin', 'gerente'].includes(req.usuario?.rol);
    const { rows } = await pool.query(`
      SELECT i.*, pr.nombre AS producto, d.nombre AS departamento
      FROM INVENTARIO i
      JOIN PRODUCTO     pr ON i.id_producto     = pr.id_producto
      JOIN DEPARTAMENTO d  ON i.id_departamento = d.id_departamento
      WHERE i.cantidad_disponible <= i.cantidad_minima
        ${isManager ? '' : `AND i.id_departamento = ${Number(req.usuario?.id_departamento) || 0}`}
      ORDER BY i.cantidad_disponible ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function update(req, res) {
  const { cantidad_disponible, cantidad_minima, id_producto, id_departamento } = req.body;
  try {
    const isManager = ['admin', 'gerente'].includes(req.usuario?.rol);
    const ownDepartment = Number(req.usuario?.id_departamento);
    const targetDepartment = Number(id_departamento);
    if (!isManager && targetDepartment && targetDepartment !== ownDepartment) {
      return res.status(403).json({ error: 'Solo puedes modificar el inventario de tu departamento' });
    }
    const { rows } = await pool.query(`
      UPDATE INVENTARIO
      SET id_producto = COALESCE($1, id_producto),
          id_departamento = COALESCE($2, id_departamento),
          cantidad_disponible = COALESCE($3, cantidad_disponible),
          cantidad_minima     = COALESCE($4, cantidad_minima)
      WHERE id_inventario = $5
        AND ($6 OR id_departamento = $7)
      RETURNING *
    `, [id_producto || null, isManager ? id_departamento || null : ownDepartment,
      cantidad_disponible, cantidad_minima, req.params.id, isManager, ownDepartment]);
    if (!rows[0]) return res.status(404).json({ error: 'Inventario no encontrado' });
    publish('inventory.updated', rows[0]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  const { id_producto, id_departamento, cantidad_disponible = 0, cantidad_minima = 1 } = req.body;
  const isManager = ['admin', 'gerente'].includes(req.usuario?.rol);
  const department = isManager ? Number(id_departamento) : Number(req.usuario?.id_departamento);
  if (!id_producto || !department) return res.status(400).json({ error: 'Producto y departamento son obligatorios' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO INVENTARIO (id_producto, id_departamento, cantidad_disponible, cantidad_minima)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id_producto, department, cantidad_disponible, cantidad_minima]);
    publish('inventory.created', rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese producto ya existe en el departamento' });
    res.status(500).json({ error: err.message });
  }
}

export async function remove(req, res) {
  try {
    const isManager = ['admin', 'gerente'].includes(req.usuario?.rol);
    const { rows } = await pool.query(`
      DELETE FROM INVENTARIO
      WHERE id_inventario = $1 AND ($2 OR id_departamento = $3)
      RETURNING *
    `, [req.params.id, isManager, req.usuario?.id_departamento]);
    if (!rows[0]) return res.status(404).json({ error: 'Inventario no encontrado' });
    publish('inventory.deleted', rows[0]);
    res.json({ mensaje: 'Inventario eliminado correctamente' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}