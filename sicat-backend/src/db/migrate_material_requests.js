import pool from './pool.js';

const statements = [
  'ALTER TABLE PEDIDO_MATERIAL ALTER COLUMN id_producto DROP NOT NULL',
  'ALTER TABLE PEDIDO_MATERIAL ADD COLUMN IF NOT EXISTS descripcion_material TEXT',
  'ALTER TABLE PEDIDO_MATERIAL ADD COLUMN IF NOT EXISTS cantidad_solicitada INT NOT NULL DEFAULT 1',
  'ALTER TABLE ASIGNACION ADD COLUMN IF NOT EXISTS id_pedido INT',
  'ALTER TABLE ASIGNACION ADD COLUMN IF NOT EXISTS cantidad INT NOT NULL DEFAULT 1',
  'ALTER TABLE ASIGNACION ADD COLUMN IF NOT EXISTS es_devolvible BOOLEAN NOT NULL DEFAULT FALSE',
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = lower('fk_pedidoAS')
     ) THEN
       ALTER TABLE ASIGNACION ADD CONSTRAINT fk_pedidoAS
       FOREIGN KEY (id_pedido) REFERENCES PEDIDO_MATERIAL(id_pedido);
     END IF;
   END $$`,
];

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const statement of statements) await client.query(statement);
    await client.query('COMMIT');
    console.log('Migración de solicitudes y asignaciones completada.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en migración de solicitudes y asignaciones:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
