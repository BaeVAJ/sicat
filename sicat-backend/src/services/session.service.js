import crypto from 'node:crypto';
import pool from '../db/pool.js';
import { SESSION_IDLE_MINUTES, SESSION_TTL_MS } from '../utils/cookieConfig.js';

const TOUCH_THROTTLE_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
let cleanupTimer = null;

/**
 * Calcula el hash SHA-256 en hexadecimal del token opaco recibido en la cookie.
 */
export function hashSessionToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

/**
 * Genera un token opaco de 256 bits y persiste únicamente su hash en SESIONES.
 */
export async function crearSesion({ idUsuario, ip = '', userAgent = '' }) {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(rawToken);
  const expiraEn = new Date(Date.now() + SESSION_TTL_MS);
  const ipSanitizada = String(ip || '').slice(0, 64) || null;
  const uaSanitizado = String(userAgent || '').slice(0, 512) || null;

  await pool.query(
    `INSERT INTO SESIONES (token_hash, id_usuario, ip, user_agent, expira_en)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenHash, idUsuario, ipSanitizada, uaSanitizado, expiraEn]
  );

  return { rawToken, tokenHash, expiraEn };
}

/**
 * Valida una sesión opaca contra PostgreSQL, aplicando expiración absoluta,
 * idle timeout, revocación y estado vigente del usuario en tiempo real.
 */
export async function validarSesion(rawToken) {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 20) {
    return { ok: false, reason: 'INVALID' };
  }

  const tokenHash = hashSessionToken(rawToken);
  const { rows } = await pool.query(
    `SELECT
       s.token_hash,
       s.id_usuario,
       s.ultimo_uso_en,
       s.expira_en,
       s.revocada_en,
       u.nombre,
       u.correo,
       u.rol,
       u.id_departamento,
       u.estatus_empleado,
       d.nombre AS departamento
     FROM SESIONES s
     JOIN USUARIOS u ON u.id_usuario = s.id_usuario
     LEFT JOIN DEPARTAMENTO d ON d.id_departamento = u.id_departamento
     WHERE s.token_hash = $1`,
    [tokenHash]
  );

  const row = rows[0];
  if (!row) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  if (row.revocada_en) {
    return { ok: false, reason: 'REVOKED' };
  }

  const ahora = Date.now();
  if (new Date(row.expira_en).getTime() <= ahora) {
    return { ok: false, reason: 'EXPIRED' };
  }

  const ultimoUsoMs = new Date(row.ultimo_uso_en).getTime();
  if (ahora - ultimoUsoMs > SESSION_IDLE_MINUTES * 60 * 1000) {
    pool
      .query(
        `UPDATE SESIONES SET revocada_en = NOW() WHERE token_hash = $1 AND revocada_en IS NULL`,
        [tokenHash]
      )
      .catch(() => {});
    return { ok: false, reason: 'IDLE_EXPIRED' };
  }

  if (row.estatus_empleado && row.estatus_empleado !== 'activo') {
    return {
      ok: false,
      reason: 'ACCOUNT_DISABLED',
      estatus: row.estatus_empleado,
    };
  }

  if (ahora - ultimoUsoMs >= TOUCH_THROTTLE_MS) {
    pool
      .query(
        `UPDATE SESIONES SET ultimo_uso_en = NOW() WHERE token_hash = $1 AND revocada_en IS NULL`,
        [tokenHash]
      )
      .catch(() => {});
  }

  return {
    ok: true,
    tokenHash: row.token_hash,
    usuario: {
      id_usuario: row.id_usuario,
      nombre: row.nombre,
      correo: row.correo,
      rol: row.rol,
      id_departamento: row.id_departamento,
      departamento: row.departamento,
      estatus_empleado: row.estatus_empleado,
    },
  };
}

/**
 * Revoca una sesión individual a partir del token recibido en cookie.
 */
export async function revocarSesionPorToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const tokenHash = hashSessionToken(rawToken);
  await pool.query(
    `UPDATE SESIONES SET revocada_en = NOW() WHERE token_hash = $1 AND revocada_en IS NULL`,
    [tokenHash]
  );
  return tokenHash;
}

/**
 * Revoca todas las sesiones activas de un usuario (opcionalmente conservando una).
 */
export async function revocarTodasLasSesiones(idUsuario, { exceptoTokenHash = null } = {}) {
  if (exceptoTokenHash) {
    const { rowCount } = await pool.query(
      `UPDATE SESIONES
       SET revocada_en = NOW()
       WHERE id_usuario = $1 AND revocada_en IS NULL AND token_hash <> $2`,
      [idUsuario, exceptoTokenHash]
    );
    return rowCount || 0;
  }

  const { rowCount } = await pool.query(
    `UPDATE SESIONES
     SET revocada_en = NOW()
     WHERE id_usuario = $1 AND revocada_en IS NULL`,
    [idUsuario]
  );
  return rowCount || 0;
}

/**
 * Lista las sesiones activas del usuario sin exponer hashes ni tokens.
 */
export async function listarSesionesActivas(idUsuario, currentTokenHash = null) {
  const { rows } = await pool.query(
    `SELECT
       ip,
       user_agent,
       creado_en,
       ultimo_uso_en,
       expira_en,
       (token_hash = $2) AS es_actual
     FROM SESIONES
     WHERE id_usuario = $1
       AND revocada_en IS NULL
       AND expira_en > NOW()
       AND ultimo_uso_en > NOW() - ($3::int * INTERVAL '1 minute')
     ORDER BY ultimo_uso_en DESC`,
    [idUsuario, currentTokenHash, SESSION_IDLE_MINUTES]
  );
  return rows;
}

/**
 * Elimina registros antiguos de sesiones expiradas o revocadas hace más de 30 días.
 */
export async function limpiarSesionesExpiradas() {
  const { rowCount } = await pool.query(
    `DELETE FROM SESIONES
     WHERE expira_en < NOW() - INTERVAL '30 days'
        OR (revocada_en IS NOT NULL AND revocada_en < NOW() - INTERVAL '30 days')`
  );
  return rowCount || 0;
}

/**
 * Programa la limpieza periódica de sesiones antiguas sin bloquear el apagado del proceso.
 */
export function iniciarLimpiezaPeriodicaSesiones() {
  limpiarSesionesExpiradas().catch((err) => {
    console.warn('[SESIONES] Error en limpieza inicial:', err.message);
  });

  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      limpiarSesionesExpiradas().catch((err) => {
        console.warn('[SESIONES] Error en limpieza periódica:', err.message);
      });
    }, CLEANUP_INTERVAL_MS);
    cleanupTimer.unref?.();
  }
}
