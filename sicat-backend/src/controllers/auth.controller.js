import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import {
  cerrarStreamsSesion,
  cerrarStreamsUsuario,
} from './events.controller.js';
import {
  crearSesion,
  listarSesionesActivas,
  revocarSesionPorToken,
  revocarTodasLasSesiones,
} from '../services/session.service.js';
import {
  clearSessionCookies,
  getSessionCookieName,
  getSessionCookieOptions,
  getSessionTokenFromRequest,
} from '../utils/cookieConfig.js';
import { enviarErrorInterno } from '../utils/errorHandler.js';

const ROLES_VALIDOS = ['admin', 'gerente', 'usuario'];
const ESTATUS_VALIDOS = ['activo', 'inactivo', 'suspendido'];
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('sicat-timing-guard', 10);

export async function login(req, res) {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Correo y contrasena son requeridos' });
  }

  const correoNorm = String(correo).trim().toLowerCase();

  try {
    const { rows } = await pool.query(
      `SELECT u.*, d.nombre AS departamento
       FROM USUARIOS u
       LEFT JOIN DEPARTAMENTO d ON u.id_departamento = d.id_departamento
       WHERE LOWER(u.correo) = $1`,
      [correoNorm]
    );
    const usuario = rows[0];
    const valida = await bcrypt.compare(
      String(contrasena),
      usuario ? usuario.contrasena : DUMMY_BCRYPT_HASH
    );

    if (!usuario || !valida) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    if (usuario.estatus_empleado && usuario.estatus_empleado !== 'activo') {
      return res.status(403).json({
        error: `Tu cuenta está ${usuario.estatus_empleado}. Contacta al administrador.`,
      });
    }

    const { rawToken } = await crearSesion({
      idUsuario: usuario.id_usuario,
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.cookie(getSessionCookieName(), rawToken, getSessionCookieOptions());

    const { contrasena: _, ...datos } = usuario;
    return res.json({ usuario: datos });
  } catch (error) {
    return enviarErrorInterno(res, error, 'auth.login');
  }
}

export async function me(req, res) {
  return res.json(req.usuario);
}

export async function registrar(req, res) {
  const { nombre, correo, contrasena, rol, id_departamento, estatus_empleado } = req.body;
  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: 'LOS CAMPOS NOMBRE, CONTRASENA Y CORREO SON REQUERIDOS' });
  }
  if (String(contrasena).length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }
  if (rol !== undefined && rol !== null && rol !== '' && !ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  if (
    estatus_empleado !== undefined &&
    estatus_empleado !== null &&
    estatus_empleado !== '' &&
    !ESTATUS_VALIDOS.includes(estatus_empleado)
  ) {
    return res.status(400).json({ error: 'Estatus de empleado inválido' });
  }

  const estatusFinal = estatus_empleado || 'activo';

  try {
    const hash = await bcrypt.hash(String(contrasena), 10);
    const { rows } = await pool.query(
      `INSERT INTO USUARIOS (nombre, correo, contrasena, rol, id_departamento, estatus_empleado)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_usuario, nombre, correo, rol, estatus_empleado`,
      [
        String(nombre).trim(),
        String(correo).trim().toLowerCase(),
        hash,
        rol || 'usuario',
        id_departamento || null,
        estatusFinal,
      ]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'EL CORREO YA A SIDO REGISTRADO' });
    }
    return enviarErrorInterno(res, err, 'auth.registrar');
  }
}

export async function logout(req, res) {
  try {
    const rawToken = getSessionTokenFromRequest(req);
    if (rawToken) {
      const tokenHash = await revocarSesionPorToken(rawToken);
      if (tokenHash) {
        cerrarStreamsSesion(tokenHash);
      }
    }
  } catch (error) {
    console.warn('[auth.logout] Error al revocar sesión:', error.message);
  }

  clearSessionCookies(res);
  return res.status(200).json({ message: 'Sesión cerrada' });
}

export async function logoutAll(req, res) {
  try {
    await revocarTodasLasSesiones(req.usuario.id_usuario);
    cerrarStreamsUsuario(req.usuario.id_usuario);
    clearSessionCookies(res);
    return res.status(200).json({ message: 'Todas las sesiones fueron cerradas' });
  } catch (error) {
    return enviarErrorInterno(res, error, 'auth.logoutAll');
  }
}

export async function sesiones(req, res) {
  try {
    const activas = await listarSesionesActivas(req.usuario.id_usuario, req.sessionHash);
    return res.json({ sesiones: activas });
  } catch (error) {
    return enviarErrorInterno(res, error, 'auth.sesiones');
  }
}
