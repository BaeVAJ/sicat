import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

export async function login(req, res) {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) {
        return res.status(400).json({ error: 'Correo y contrasena son requeridos' })
    }
    try {
        const { rows } = await pool.query(
            `Select u.*, d.nombre AS departamento
            from USUARIOS u 
            LEFT JOIN DEPARTAMENTO d ON u.id_departamento = d.id_departamento 
            WHERE u.correo = $1`,
            [correo]
        );
        const usuario = rows[0];
        if (!usuario) {
            return res.status(401).json({ error: 'Credenciales incorrectas' })
        }
        const valida = await bcrypt.compare(contrasena, usuario.contrasena);
        if (!valida) {
            return res.status(401).json({ error: 'Credenciales incorrectas' })
        }

        // 🔒 Bloqueo por estatus: si no está activo, no puede iniciar sesión
        if (usuario.estatus_empleado && usuario.estatus_empleado !== 'activo') {
            return res.status(403).json({
                error: `Tu cuenta está ${usuario.estatus_empleado}. Contacta al administrador.`
            });
        }

        const token = jwt.sign(
            {
                id_usuario: usuario.id_usuario,
                rol: usuario.rol,
                nombre: usuario.nombre,
                id_departamento: usuario.id_departamento,
                departamento: usuario.departamento,
                estatus_empleado: usuario.estatus_empleado
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        const { contrasena: _, ...datos } = usuario;
        res.json({ token, usuario: datos });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function me(req, res) {
    try {
        const { rows } = await pool.query(
            `SELECT u.id_usuario, u.nombre, u.correo, u.rol, u.id_departamento, u.estatus_empleado, d.nombre as departamento
                from USUARIOS u
                LEFT JOIN DEPARTAMENTO d on u.id_departamento = d.id_departamento
                WHERE u.id_usuario = $1`,
            [req.usuario.id_usuario]
        );
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

export async function registrar(req, res) {
    const { nombre, correo, contrasena, rol, id_departamento, estatus_empleado } = req.body;
    if (!nombre || !correo || !contrasena) {
        return res.status(400).json({ error: 'LOS CAMPOS NOMBRE, CONTRASENA Y CORREO SON REQUERIDOS' })
    }

    const estatusFinal = estatus_empleado || 'activo';

    try {
        const hash = await bcrypt.hash(contrasena, 10);
        const { rows } = await pool.query(`
            INSERT INTO USUARIOS (nombre, correo, contrasena, rol, id_departamento, estatus_empleado)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id_usuario, nombre, correo, rol, estatus_empleado`,
            [nombre, correo, hash, rol || 'usuario', id_departamento || null, estatusFinal]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code == '23505') {
            return res.status(409).json({ error: 'EL CORREO YA A SIDO REGISTRADO' });
        }
        res.status(500).json({ error: err.message })
    }
}