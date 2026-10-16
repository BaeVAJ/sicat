import pool from './pool.js';

const statements = [
  'ALTER TABLE TICKETS ADD COLUMN IF NOT EXISTS fecha_limite DATE',
  `UPDATE TICKETS
   SET fecha_limite = CURRENT_DATE + 3
   WHERE fecha_limite IS NULL`,
  'ALTER TABLE TICKETS ALTER COLUMN fecha_limite SET DEFAULT (CURRENT_DATE + 3)',
  'ALTER TABLE TICKETS ALTER COLUMN fecha_limite SET NOT NULL',
];

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const statement of statements) await client.query(statement);
    await client.query('COMMIT');
    console.log('Migración de fecha límite de tickets completada.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en migración de fecha límite de tickets:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
