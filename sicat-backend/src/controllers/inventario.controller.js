import pool from '../db/pool.js';
import { publish } from '../services/eventBus.js';

const DEPARTAMENTO_SISTEMAS = 1;

function enviarErrorServidor(res, err, contexto) {
  console.error(`Error en inventario (${contexto}):`, err);
  return res.status(500).json({
    error: 'Error interno del servidor',
    detalle: err?.message ?? String(err),
    codigo: err?.code ?? null,
  });
}

const esEnteroPositivo = (v) => Number.isInteger(Number(v)) && Number(v) > 0 && String(v).trim() !== '';
const esEnteroNoNegativo = (v) => Number.isInteger(Number(v)) && Number(v) >= 0 && String(v).trim() !== '';

function validarCantidades(res, campos) {
  for (const [campo, valor] of campos) {
    if (valor != null && !esEnteroNoNegativo(valor)) {
      res.status(400).json({ error: `${campo} debe ser un entero mayor o igual a 0` });
      return false;
    }
  }
  return true;
}

export async function getAll(req, res){
  try {
    const {rows} = await pool.query(`
      SELECT i.*, pr.nombre AS producto, pr.marca, pr.modelo, d.nombre AS departamento, e.nombre AS empresa
      FROM INVENTARIO i
      JOIN PRODUCTO pr ON i.id_producto = pr.id_producto
      JOIN DEPARTAMENTO d ON i.id_departamento = d.id_departamento
      JOIN EMPRESA e ON d.id_empresa = e.id_empresa
      ORDER BY e.nombre
      `)
      res.json(rows);
  } catch (err){
    enviarErrorServidor(res, err, 'getAll');
  }
}

export async function getByDpt(req, res) {
  try {
    const departamentoUsuario = Number(req.usuario?.id_departamento);
    const esSistemas = departamentoUsuario === DEPARTAMENTO_SISTEMAS;
    const { rows } = await pool.query(`
      SELECT i.*, pr.nombre AS producto, pr.marca, pr.modelo,
             d.nombre AS departamento, e.nombre AS empresa
      FROM INVENTARIO i
      JOIN PRODUCTO     pr ON i.id_producto     = pr.id_producto
      JOIN DEPARTAMENTO d  ON i.id_departamento = d.id_departamento
      JOIN EMPRESA       e ON d.id_empresa      = e.id_empresa
      WHERE ${esSistemas ? 'TRUE' : 'i.id_departamento = $1'}
      ORDER BY e.nombre, d.nombre, pr.nombre
    `, esSistemas ? [] : [departamentoUsuario || 0]);
    res.json(rows);
  } catch (err) { enviarErrorServidor(res, err, 'getByDpt'); }
}

export async function getByDepartamento(req, res) {
  try {
    const departamentoUsuario = Number(req.usuario?.id_departamento);
    const esSistemas = departamentoUsuario === DEPARTAMENTO_SISTEMAS;
    if (!esEnteroPositivo(req.params.id)) {
      return res.status(400).json({ error: 'El id de departamento no es válido' });
    }
    const departamentoSolicitado = Number(req.params.id);
    if (!esSistemas && departamentoSolicitado !== departamentoUsuario) {
      return res.status(403).json({ error: 'Solo puedes consultar el inventario de tu departamento' });
    }
    const { rows } = await pool.query(`
      SELECT i.*, pr.nombre AS producto, pr.marca, pr.modelo
      FROM INVENTARIO i
      JOIN PRODUCTO pr ON i.id_producto = pr.id_producto
      WHERE i.id_departamento = $1
      ORDER BY pr.nombre
    `, [departamentoSolicitado]);
    res.json(rows);
  } catch (err) { enviarErrorServidor(res, err, 'getByDepartamento'); }
}

export async function getAlertas(req, res) {
  try {
    const esSistemas = Number(req.usuario?.id_departamento) === DEPARTAMENTO_SISTEMAS;
    const { rows } = await pool.query(`
      SELECT i.*, pr.nombre AS producto, d.nombre AS departamento
      FROM INVENTARIO i
      JOIN PRODUCTO     pr ON i.id_producto     = pr.id_producto
      JOIN DEPARTAMENTO d  ON i.id_departamento = d.id_departamento
      WHERE i.cantidad_disponible <= i.cantidad_minima
        ${esSistemas ? '' : 'AND i.id_departamento = $1'}
      ORDER BY i.cantidad_disponible ASC
    `, esSistemas ? [] : [Number(req.usuario?.id_departamento) || 0]);
    res.json(rows);
  } catch (err) { enviarErrorServidor(res, err, 'getAlertas'); }
}

export async function update(req, res) {
  const { cantidad_disponible, cantidad_minima, id_producto, id_departamento } = req.body;
  try {
    const deptoToken = Number(req.usuario?.id_departamento);
    const esSistemas = deptoToken === DEPARTAMENTO_SISTEMAS;
    const departamentoUsuario = esSistemas ? Number(id_departamento) : deptoToken;
    if (!Number.isInteger(departamentoUsuario) || departamentoUsuario <= 0) {
      return res.status(403).json({ error: 'Tu usuario no tiene un departamento asignado' });
    }

    if (!esEnteroPositivo(req.params.id)) {
      return res.status(400).json({ error: 'El id de inventario no es válido' });
    }
    const idInventario = Number(req.params.id);

    const departamentoSolicitado = id_departamento == null ? null : Number(id_departamento);
    if (departamentoSolicitado != null && departamentoSolicitado !== departamentoUsuario && !esSistemas) {
      return res.status(403).json({ error: 'Solo puedes modificar el inventario de tu departamento' });
    }

    if (!validarCantidades(res, [['cantidad_disponible', cantidad_disponible], ['cantidad_minima', cantidad_minima]])) return;

    const { rows } = await pool.query(`
      UPDATE INVENTARIO
      SET id_producto = COALESCE($1, id_producto),
          id_departamento = COALESCE($2, id_departamento),
          cantidad_disponible = COALESCE($3, cantidad_disponible),
          cantidad_minima     = COALESCE($4, cantidad_minima)
      WHERE id_inventario = $5
        AND id_departamento = $6
      RETURNING *
    `, [id_producto ?? null, departamentoSolicitado, cantidad_disponible ?? null,
      cantidad_minima ?? null, idInventario, departamentoUsuario]);
    if (!rows[0]) return res.status(404).json({ error: 'Inventario no encontrado' });
    publish('inventory.updated', rows[0]);
    res.json(rows[0]);
  } catch (err) { enviarErrorServidor(res, err, 'update'); }
}

export async function create(req, res) {
  const { id_producto, id_departamento, cantidad_disponible = 0, cantidad_minima = 1 } = req.body;
  const department = Number(req.usuario?.id_departamento);
  const esSistemas = (department === DEPARTAMENTO_SISTEMAS);

  if (!Number.isInteger(department) || department <= 0)
    return res.status(403).json({ error: 'Tu usuario no tiene un departamento asignado' });
  
      // Si el usuario no es de sistemas, solo puede crear inventario para su propio departamento
  if ((id_departamento != null && Number(id_departamento) !== department) && !esSistemas)
    return res.status(403).json({ error: 'Solo puedes modificar el inventario de tu departamento' });
  
  if (id_producto == null || !esEnteroPositivo(id_producto))
    return res.status(400).json({ error: 'Producto y departamento son obligatorios' });
  if (!validarCantidades(res, [['cantidad_disponible', cantidad_disponible], ['cantidad_minima', cantidad_minima]])) return;
  
  try {
    const { rows } = await pool.query(`
      INSERT INTO INVENTARIO (id_producto, id_departamento, cantidad_disponible, cantidad_minima)
      VALUES ($1, $2, $3, $4)

      ON CONFLICT (id_producto, id_departamento)
      DO UPDATE SET
        cantidad_disponible = COALESCE(EXCLUDED.cantidad_disponible, INVENTARIO.cantidad_disponible),
        cantidad_minima     = COALESCE(EXCLUDED.cantidad_minima, INVENTARIO.cantidad_minima)
      RETURNING *;

    `, [Number(id_producto), Number(id_departamento), Number(cantidad_disponible), Number(cantidad_minima)]);
    publish('inventory.created', rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese producto ya existe en el departamento' });
    enviarErrorServidor(res, err, 'create');
  }
}

export async function remove(req, res) {
  try {
    const departamentoUsuario = Number(req.usuario?.id_departamento);
    if (!Number.isInteger(departamentoUsuario) || departamentoUsuario <= 0) {
      return res.status(403).json({ error: 'Tu usuario no tiene un departamento asignado' });
    }
    if (!esEnteroPositivo(req.params.id)) {
      return res.status(400).json({ error: 'El id de inventario no es válido' });
    }
    const esSistemas = departamentoUsuario === DEPARTAMENTO_SISTEMAS;
    const { rows } = await pool.query(`
      DELETE FROM INVENTARIO
      WHERE id_inventario = $1
        ${esSistemas ? '' : 'AND id_departamento = $2'}
      RETURNING *
    `, esSistemas ? [Number(req.params.id)] : [Number(req.params.id), departamentoUsuario]);
    if (!rows[0]) return res.status(404).json({ error: 'Inventario no encontrado' });
    publish('inventory.deleted', rows[0]);
    res.json({ mensaje: 'Inventario eliminado correctamente' });
  } catch (err) { enviarErrorServidor(res, err, 'remove'); }
}