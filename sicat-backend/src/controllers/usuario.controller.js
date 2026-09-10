import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';

const ESTATUS_VALIDOS = ['activo', 'inactivo', 'suspendido'];

export async function getAll(req, res) {
    try {
        const { rows } = await pool.query(`
            SELECT 
                u.id_usuario,
                u.nombre,
                u.correo,
                u.rol,
                u.id_departamento,
                u.estatus_empleado,
                d.nombre AS departamento_nombre,
                d.id_empresa,
                e.nombre AS empresa_nombre
            FROM USUARIOS u
            LEFT JOIN DEPARTAMENTO d ON u.id_departamento = d.id_departamento
            LEFT JOIN EMPRESA e ON d.id_empresa = e.id_empresa
            ORDER BY u.id_usuario DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function getById(req, res) {
    try {
        const { rows } = await pool.query(`
            SELECT 
                u.id_usuario,
                u.nombre,
                u.correo,
                u.rol,
                u.id_departamento,
                u.estatus_empleado,
                d.nombre AS departamento_nombre,
                d.id_empresa,
                e.nombre AS empresa_nombre
            FROM USUARIOS u
            LEFT JOIN DEPARTAMENTO d ON u.id_departamento = d.id_departamento
            LEFT JOIN EMPRESA e ON d.id_empresa = e.id_empresa
            WHERE u.id_usuario = $1
        `, [req.params.id]);

        if (!rows[0]) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

export async function create(req, res) {
    const { nombre, correo, contrasena, rol, id_departamento, estatus_empleado } = req.body;

    if (!nombre || !correo || !contrasena) {
        return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
    }

    if (estatus_empleado !== undefined && !ESTATUS_VALIDOS.includes(estatus_empleado)) {
        return res.status(400).json({ error: 'Estatus de empleado inválido' });
    }

    // Por defecto se crea como 'activo'
    const estatusFinal = estatus_empleado || 'activo';

    try {
        const hash = await bcrypt.hash(contrasena, 10);
        const { rows } = await pool.query(`
            INSERT INTO USUARIOS (nombre, correo, contrasena, rol, id_departamento, estatus_empleado)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id_usuario
        `, [
            nombre.trim(),
            correo.trim().toLowerCase(),
            hash,
            rol || 'usuario',
            id_departamento ? Number(id_departamento) : null,
            estatusFinal
        ]);

        const nuevoId = rows[0].id_usuario;
        const resQuery = await pool.query(`
            SELECT 
                u.id_usuario,
                u.nombre,
                u.correo,
                u.rol,
                u.id_departamento,
                u.estatus_empleado,
                d.nombre AS departamento_nombre,
                d.id_empresa,
                e.nombre AS empresa_nombre
            FROM USUARIOS u
            LEFT JOIN DEPARTAMENTO d ON u.id_departamento = d.id_departamento
            LEFT JOIN EMPRESA e ON d.id_empresa = e.id_empresa
            WHERE u.id_usuario = $1
        `, [nuevoId]);

        res.status(201).json(resQuery.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'El correo ya se encuentra registrado' });
        }
        res.status(500).json({ error: err.message });
    }
}

export async function update(req, res) {
    const { id } = req.params;
    const { nombre, correo, contrasena, rol, id_departamento, estatus_empleado } = req.body;

    if (!nombre || !correo) {
        return res.status(400).json({ error: 'Nombre y correo son requeridos' });
    }

    if (estatus_empleado !== undefined && estatus_empleado !== null && !ESTATUS_VALIDOS.includes(estatus_empleado)) {
        return res.status(400).json({ error: 'Estatus de empleado inválido. Debe ser activo, inactivo o suspendido.' });
    }

    try {
        // Construimos el SET dinámicamente para no romper con/sin contraseña y con/sin estatus
        const campos = [];
        const params = [];

        campos.push(`nombre = $${params.length + 1}`);
        params.push(nombre.trim());

        campos.push(`correo = $${params.length + 1}`);
        params.push(correo.trim().toLowerCase());

        campos.push(`rol = $${params.length + 1}`);
        params.push(rol || 'usuario');

        campos.push(`id_departamento = $${params.length + 1}`);
        params.push(id_departamento ? Number(id_departamento) : null);

        if (contrasena && contrasena.trim() !== '') {
            const hash = await bcrypt.hash(contrasena, 10);
            campos.push(`contrasena = $${params.length + 1}`);
            params.push(hash);
        }

        if (estatus_empleado !== undefined && estatus_empleado !== null) {
            campos.push(`estatus_empleado = $${params.length + 1}`);
            params.push(estatus_empleado);
        }

        const query = `
            UPDATE USUARIOS
            SET ${campos.join(', ')}
            WHERE id_usuario = $${params.length + 1}
            RETURNING id_usuario
        `;
        params.push(id);

        const { rows } = await pool.query(query, params);
        if (!rows[0]) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const resQuery = await pool.query(`
            SELECT 
                u.id_usuario,
                u.nombre,
                u.correo,
                u.rol,
                u.id_departamento,
                u.estatus_empleado,
                d.nombre AS departamento_nombre,
                d.id_empresa,
                e.nombre AS empresa_nombre
            FROM USUARIOS u
            LEFT JOIN DEPARTAMENTO d ON u.id_departamento = d.id_departamento
            LEFT JOIN EMPRESA e ON d.id_empresa = e.id_empresa
            WHERE u.id_usuario = $1
        `, [id]);

        res.json(resQuery.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'El correo ya se encuentra registrado por otro usuario' });
        }
        res.status(500).json({ error: err.message });
    }
}

export async function remove(req, res) {
    const { id } = req.params;

    if (req.usuario && req.usuario.id_usuario === Number(id)) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de usuario activa' });
    }

    try {
        const { rowCount } = await pool.query(`DELETE FROM USUARIOS WHERE id_usuario = $1`, [id]);
        if (!rowCount) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(409).json({ 
                error: 'No se puede eliminar el usuario porque tiene tickets, asignaciones o registros asociados.' 
            });
        }
        res.status(500).json({ error: err.message });
    }
}