import pool from '../db/pool.js';

// GET /api/categorias
export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COUNT(p.id_producto)::int AS total_productos
      FROM CATEGORIA c
      LEFT JOIN PRODUCTO p ON c.id_categoria = p.id_categoria
      GROUP BY c.id_categoria
      ORDER BY c.id_categoria
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/categorias/:id
export async function getById(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COUNT(p.id_producto)::int AS total_productos
      FROM CATEGORIA c
      LEFT JOIN PRODUCTO p ON c.id_categoria = p.id_categoria
      WHERE c.id_categoria = $1
      GROUP BY c.id_categoria
    `, [req.params.id]);

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
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
  }

  const tiposValidos = ['equipo', 'insumo', 'accesorio'];
  const tipoFinal = tipo && tiposValidos.includes(tipo.toLowerCase()) ? tipo.toLowerCase() : 'equipo';

  try {
    const { rows } = await pool.query(`
      INSERT INTO CATEGORIA (nombre, descripcion, tipo)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [
      nombre.trim(),
      descripcion ? descripcion.trim() : null,
      tipoFinal
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

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
  }

  const tiposValidos = ['equipo', 'insumo', 'accesorio'];
  const tipoFinal = tipo && tiposValidos.includes(tipo.toLowerCase()) ? tipo.toLowerCase() : 'equipo';

  try {
    const { rows } = await pool.query(`
      UPDATE CATEGORIA
      SET nombre = $1, descripcion = $2, tipo = $3
      WHERE id_categoria = $4
      RETURNING *
    `, [
      nombre.trim(),
      descripcion ? descripcion.trim() : null,
      tipoFinal,
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
    if (err.code === '23503') {
      return res.status(400).json({ error: 'No se puede eliminar la categoría porque contiene productos asociados' });
    }
    res.status(500).json({ error: err.message });
  }
}