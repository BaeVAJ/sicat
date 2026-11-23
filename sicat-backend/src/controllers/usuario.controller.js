import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import { cerrarStreamsUsuario } from './events.controller.js';
import { revocarTodasLasSesiones } from '../services/session.service.js';
import { enviarErrorInterno, esEnteroPositivo } from '../utils/errorHandler.js';

const ESTATUS_VALIDOS = ['activo', 'inactivo', 'suspendido'];
const ROLES_VALIDOS = ['admin', 'gerente', 'usuario'];
const MIN_PASSWORD_LEN = 8;

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
        return enviarErrorInterno(res, err, 'usuario.getAll');
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
        return enviarErrorInterno(res, err, 'usuario.getById');
    }
}

export async function create(req, res) {
    const { nombre, correo, contrasena, rol, id_departamento, estatus_empleado } = req.body;

    if (!nombre || !correo || !contrasena) {
        return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
    }

    if (String(contrasena).length < MIN_PASSWORD_LEN) {
        return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres` });
    }

    if (rol !== undefined && rol !== null && rol !== '' && !ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ error: 'Rol inválido. Debe ser admin, gerente o usuario.' });
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
        return enviarErrorInterno(res, err, 'usuario.create');
    }
}

export async function update(req, res) {
    const { id } = req.params;
    const { nombre, correo, contrasena, rol, id_departamento, estatus_empleado } = req.body;

    if (!esEnteroPositivo(id)) {
        return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    if (!nombre || !correo) {
        return res.status(400).json({ error: 'Nombre y correo son requeridos' });
    }

    if (rol !== undefined && rol !== null && rol !== '' && !ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ error: 'Rol inválido. Debe ser admin, gerente o usuario.' });
    }

    if (contrasena && contrasena.trim() !== '' && String(contrasena).length < MIN_PASSWORD_LEN) {
        return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres` });
    }

    if (estatus_empleado !== undefined && estatus_empleado !== null && !ESTATUS_VALIDOS.includes(estatus_empleado)) {
        return res.status(400).json({ error: 'Estatus de empleado inválido. Debe ser activo, inactivo o suspendido.' });
    }

    try {
        const { rows: prevRows } = await pool.query(
            `SELECT rol, estatus_empleado FROM USUARIOS WHERE id_usuario = $1`,
            [id]
        );
        const previo = prevRows[0];
        if (!previo) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Construimos el SET dinámicamente para no romper con/sin contraseña y con/sin estatus
        const campos = [];
        const params = [];
        const nuevoRol = rol || 'usuario';
        const cambioContrasena = Boolean(contrasena && contrasena.trim() !== '');

        campos.push(`nombre = $${params.length + 1}`);
        params.push(nombre.trim());

        campos.push(`correo = $${params.length + 1}`);
        params.push(correo.trim().toLowerCase());

        campos.push(`rol = $${params.length + 1}`);
        params.push(nuevoRol);

        campos.push(`id_departamento = $${params.length + 1}`);
        params.push(id_departamento ? Number(id_departamento) : null);

        if (cambioContrasena) {
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

        const cambioRol = nuevoRol !== previo.rol;
        const estatusResultante =
            estatus_empleado !== undefined && estatus_empleado !== null
                ? estatus_empleado
                : previo.estatus_empleado;
        const cuentaDesactivada = estatusResultante !== 'activo';

        if (cambioContrasena || cambioRol || cuentaDesactivada) {
            await revocarTodasLasSesiones(Number(id));
            cerrarStreamsUsuario(Number(id));
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
        return enviarErrorInterno(res, err, 'usuario.update');
    }
}

export async function remove(req, res) {
    const { id } = req.params;

    if (!esEnteroPositivo(id)) {
        return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    if (req.usuario && req.usuario.id_usuario === Number(id)) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de usuario activa' });
    }

    try {
        const { rowCount } = await pool.query(`DELETE FROM USUARIOS WHERE id_usuario = $1`, [id]);
        if (!rowCount) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        cerrarStreamsUsuario(Number(id));
        res.json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(409).json({ 
                error: 'No se puede eliminar el usuario porque tiene tickets, asignaciones o registros asociados.' 
            });
        }
        return enviarErrorInterno(res, err, 'usuario.remove');
    }
}

export async function revocarSesiones(req, res) {
    const { id } = req.params;
    if (!esEnteroPositivo(id)) {
        return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    try {
        const idUsuario = Number(id);
        const { rows } = await pool.query(
            `SELECT id_usuario FROM USUARIOS WHERE id_usuario = $1`,
            [idUsuario]
        );
        if (!rows[0]) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const revocadas = await revocarTodasLasSesiones(idUsuario);
        cerrarStreamsUsuario(idUsuario);
        return res.json({ mensaje: 'Sesiones del usuario revocadas', revocadas });
    } catch (err) {
        return enviarErrorInterno(res, err, 'usuario.revocarSesiones');
    }
}