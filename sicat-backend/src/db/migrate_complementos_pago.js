import pool from './pool.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS DETALLES_FACTURA (
        id_detalle_factura SERIAL PRIMARY KEY,
        id_factura INT NOT NULL REFERENCES FACTURA(id_factura) ON DELETE CASCADE,
        num_pago INT,
        codigo_pago VARCHAR(50),
        fecha_pago DATE NOT NULL,
        saldo_anterior NUMERIC(10,2),
        monto_pago NUMERIC(10,2) NOT NULL,
        forma_pago VARCHAR(100),
        falta_pagar NUMERIC(10,2),
        url_pdf TEXT,
        url_xml TEXT
      )
    `);
    await client.query('ALTER TABLE DETALLES_FACTURA ADD COLUMN IF NOT EXISTS codigo_pago VARCHAR(50)');
    await client.query('ALTER TABLE DETALLES_FACTURA ADD COLUMN IF NOT EXISTS saldo_anterior NUMERIC(10,2)');
    await client.query(`
      ALTER TABLE DETALLES_FACTURA
      ALTER COLUMN forma_pago TYPE VARCHAR(100)
      USING forma_pago::VARCHAR(100)
    `);
    await client.query('ALTER TABLE DETALLES_FACTURA ALTER COLUMN num_pago DROP NOT NULL');
    await client.query('ALTER TABLE DETALLES_FACTURA ALTER COLUMN forma_pago DROP NOT NULL');
    await client.query('ALTER TABLE DETALLES_FACTURA ALTER COLUMN falta_pagar DROP NOT NULL');
    await client.query('ALTER TABLE DETALLES_FACTURA ALTER COLUMN falta_pagar TYPE NUMERIC(10,2) USING falta_pagar::numeric');
    await client.query('COMMIT');
    console.log('Tabla DETALLES_FACTURA lista para complementos de pago.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en migración de complementos:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
