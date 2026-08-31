import pool from '../db/pool.js';

export async function getAll(req, res) {
    try {
        const { rows } = await pool.query('SELECT * FROM EMPRESA ORDER BY id_empresa');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function getById(req, res) {
    try {
        const { rows } = await pool.query('SELECT * FROM EMPRESA WHERE id_empresa = $1', [req.params.id]);
        if (!rows[0]) {
            return res.status(404).json({ error: 'EMPRESA NO ENCONTRADA' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function create(req, res) {
    const { nombre, rfc, direccion, activa } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre de la empresa es requerido' });
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO EMPRESA (nombre, rfc, direccion, activa)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [nombre, rfc || null, direccion || null, activa !== undefined ? activa : true]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function update(req, res) {
    const { nombre, rfc, direccion, activa } = req.body;
    try {
        const { rows } = await pool.query(
            `UPDATE EMPRESA 
             SET nombre = COALESCE($1, nombre),
                 rfc = $2,
                 direccion = $3,
                 activa = COALESCE($4, activa)
             WHERE id_empresa = $5 RETURNING *`,
            [nombre, rfc, direccion, activa, req.params.id]
        );
        if (!rows[0]) {
            return res.status(404).json({ error: 'Empresa no encontrada' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function remove(req, res) {
    try {
        const { rowCount } = await pool.query(`DELETE FROM EMPRESA WHERE id_empresa = $1`, [req.params.id]);
        if (!rowCount) {
            return res.status(404).json({ error: 'Empresa no encontrada' });
        }
        res.json({ mensaje: 'Empresa eliminada correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}