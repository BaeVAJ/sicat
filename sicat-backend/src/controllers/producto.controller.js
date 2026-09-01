import pool from '../db/pool.js';

// GET /api/productos
export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.nombre AS categoria, c.tipo AS tipo_categoria, c.descripcion AS categoria_descripcion
      FROM PRODUCTO p
      LEFT JOIN CATEGORIA c ON p.id_categoria = c.id_categoria
      ORDER BY p.id_producto DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/productos/:id
export async function getById(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, c.nombre AS categoria, c.tipo AS tipo_categoria, c.descripcion AS categoria_descripcion
      FROM PRODUCTO p
      LEFT JOIN CATEGORIA c ON p.id_categoria = c.id_categoria
      WHERE p.id_producto = $1
    `, [req.params.id]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/productos
export async function create(req, res) {
  const { id_categoria, nombre, marca, modelo } = req.body;

  if (!nombre || !id_categoria) {
    return res.status(400).json({ error: 'El nombre y la categoría son obligatorios' });
  }

  try {
    const { rows } = await pool.query(`
      INSERT INTO PRODUCTO (id_categoria, nombre, marca, modelo)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      Number(id_categoria),
      nombre.trim(),
      marca ? marca.trim() : null,
      modelo ? modelo.trim() : null,
    ]);

    // Devolver producto enriquecido con su categoría
    const { rows: enriched } = await pool.query(`
      SELECT p.*, c.nombre AS categoria, c.tipo AS tipo_categoria
      FROM PRODUCTO p
      LEFT JOIN CATEGORIA c ON p.id_categoria = c.id_categoria
      WHERE p.id_producto = $1
    `, [rows[0].id_producto]);

    res.status(201).json(enriched[0] || rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// PUT /api/productos/:id
export async function update(req, res) {
  const { id_categoria, nombre, marca, modelo } = req.body;
  const { id } = req.params;

  if (!nombre || !id_categoria) {
    return res.status(400).json({ error: 'El nombre y la categoría son obligatorios' });
  }

  try {
    const { rows } = await pool.query(`
      UPDATE PRODUCTO
      SET id_categoria = $1, nombre = $2, marca = $3, modelo = $4
      WHERE id_producto = $5
      RETURNING *
    `, [
      Number(id_categoria),
      nombre.trim(),
      marca ? marca.trim() : null,
      modelo ? modelo.trim() : null,
      id,
    ]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Devolver producto enriquecido con su categoría
    const { rows: enriched } = await pool.query(`
      SELECT p.*, c.nombre AS categoria, c.tipo AS tipo_categoria
      FROM PRODUCTO p
      LEFT JOIN CATEGORIA c ON p.id_categoria = c.id_categoria
      WHERE p.id_producto = $1
    `, [rows[0].id_producto]);

    res.json(enriched[0] || rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/productos/:id
export async function remove(req, res) {
  try {
    const { rowCount } = await pool.query('DELETE FROM PRODUCTO WHERE id_producto = $1', [req.params.id]);
    if (!rowCount) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Producto eliminado correctamente', id_producto: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}