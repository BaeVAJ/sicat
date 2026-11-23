import pool from './pool.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS SESIONES (
        token_hash TEXT PRIMARY KEY,
        id_usuario INTEGER NOT NULL REFERENCES USUARIOS(id_usuario) ON DELETE CASCADE,
        ip VARCHAR(64),
        user_agent TEXT,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ultimo_uso_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expira_en TIMESTAMPTZ NOT NULL,
        revocada_en TIMESTAMPTZ
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_activa
      ON SESIONES (id_usuario)
      WHERE revocada_en IS NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sesiones_expira
      ON SESIONES (expira_en);
    `);
    await client.query('COMMIT');
    console.log('Tabla SESIONES e índices creados correctamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en migración de SESIONES:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
