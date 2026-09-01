import pool from '../db/pool.js';

// GET /api/categorias
export async function getAll(req, res) {
  try {
    const { rows } = await pool.query('SELECT * FROM CATEGORIA ORDER BY id_categoria');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/categorias/:id
export async function getById(req, res) {
  try {
    const { rows } = await pool.query('SELECT * FROM CATEGORIA WHERE id_categoria = $1', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/categorias
export async function create(req, res) {
  const { nombre, descripcion, tipo } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
  }

  try {
    const { rows } = await pool.query(`
      INSERT INTO CATEGORIA (nombre, descripcion, tipo)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [
      nombre.trim(),
      descripcion ? descripcion.trim() : null,
      tipo || 'GENERAL'
    ]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// PUT /api/categorias/:id
export async function update(req, res) {
  const { nombre, descripcion, tipo } = req.body;
  const { id } = req.params;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
  }

  try {
    const { rows } = await pool.query(`
      UPDATE CATEGORIA
      SET nombre = $1, descripcion = $2, tipo = $3
      WHERE id_categoria = $4
      RETURNING *
    `, [
      nombre.trim(),
      descripcion ? descripcion.trim() : null,
      tipo || 'GENERAL',
      id
    ]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/categorias/:id
export async function remove(req, res) {
  try {
    const { rowCount } = await pool.query('DELETE FROM CATEGORIA WHERE id_categoria = $1', [req.params.id]);
    if (!rowCount) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json({ mensaje: 'Categoría eliminada correctamente', id_categoria: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}