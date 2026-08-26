import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js'

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
        const token = jwt.sign(
            { id_usuario: usuario.id_usuario, rol: usuario.rol, nombre: usuario.nombre },
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
            `SELECT u.id_usuario, u.nombre, u.correo, u.rol, d.nombre as departamento
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
    const { nombre, correo, contrasena, rol, id_departamento } = req.body;
    if (!nombre || !correo || !contrasena) {
        return res.status(400).json({ error: 'LOS CAMPOS NOMBRE, CONTRASENA Y CORREO SON REQUERIDOS' })
    }

    try {
        const hash = await bcrypt.hash(contrasena, 10);
        const { rows } = await pool.query(`
            INSERT INTO USUARIOS (nombre, correo, contrasena, rol, id_departamento)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id_usuario, nombre, correo, rol`,
            [nombre, correo, hash, rol || 'usuario', id_departamento || null]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code == '23505') {
            return res.status(409).json({ error: 'EL CORREO YA A SIDO REGISTRADO' });
        }
        res.status(500).json({ error: err.message })
    }
}