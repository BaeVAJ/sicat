import pool from '../db/pool.js';

// GET /api/proveedores
export async function getAll(req, res) {
  try {
    const { rows } = await pool.query('SELECT * FROM PROVEEDOR ORDER BY id_proveedor');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/proveedores/:id
export async function getById(req, res) {
  try {
    const { rows } = await pool.query('SELECT * FROM PROVEEDOR WHERE id_proveedor = $1', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/proveedores
export async function create(req, res) {
  const { nombre, telefono, email, tipo_pago } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
  }

  const tiposValidos = ['Contado', 'Credito', 'Transferencia', 'Cheque'];
  const tipoPagoFinal = tipo_pago && tiposValidos.includes(tipo_pago) ? tipo_pago : 'Transferencia';

  try {
    const { rows } = await pool.query(`
      INSERT INTO PROVEEDOR (nombre, telefono, email, tipo_pago)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      nombre.trim(),
      telefono ? telefono.trim().substring(0, 10) : null,
      email ? email.trim() : null,
      tipoPagoFinal
    ]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un proveedor registrado con ese correo electrónico' });
    }
    res.status(500).json({ error: error.message });
  }
}

// PUT /api/proveedores/:id
export async function update(req, res) {
  const { nombre, telefono, email, tipo_pago } = req.body;
  const { id } = req.params;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
  }

  const tiposValidos = ['Contado', 'Credito', 'Transferencia', 'Cheque'];
  const tipoPagoFinal = tipo_pago && tiposValidos.includes(tipo_pago) ? tipo_pago : 'Transferencia';

  try {
    const { rows } = await pool.query(`
      UPDATE PROVEEDOR
      SET nombre = $1, telefono = $2, email = $3, tipo_pago = $4
      WHERE id_proveedor = $5
      RETURNING *
    `, [
      nombre.trim(),
      telefono ? telefono.trim().substring(0, 10) : null,
      email ? email.trim() : null,
      tipoPagoFinal,
      id
    ]);

    if (!rows[0]) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un proveedor registrado con ese correo electrónico' });
    }
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/proveedores/:id
export async function remove(req, res) {
  try {
    const { rowCount } = await pool.query('DELETE FROM PROVEEDOR WHERE id_proveedor = $1', [req.params.id]);
    if (!rowCount) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    res.json({ mensaje: 'Proveedor eliminado correctamente', id_proveedor: req.params.id });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'No se puede eliminar el proveedor porque tiene compras o facturas asociadas' });
    }
    res.status(500).json({ error: err.message });
  }
}