import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

function buildSslConfig() {
  let ca = null;

  if (process.env.DB_SSL_CA) {
    const raw = process.env.DB_SSL_CA.trim();
    const decoded = raw.includes('-----BEGIN')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    ca = decoded.replace(/\\n/g, '\n');
  } else if (process.env.DB_SSL_CA_PATH) {
    ca = fs.readFileSync(process.env.DB_SSL_CA_PATH.trim(), 'utf8');
  }

  if (ca) {
    return { rejectUnauthorized: true, ca };
  }

  if (process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true') {
    return { rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: buildSslConfig(),
});

// Prueba rápida al iniciar y verificación de esquema
pool.connect(async (err, client, release) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.stack);
  } else {
    try {
      // 1. Asegurar que la columna archivo_xml_url exista en FACTURA
      await client.query('ALTER TABLE FACTURA ADD COLUMN IF NOT EXISTS archivo_xml_url TEXT;');

      // 2. Asegurar todos los valores enum de uso_cfdi_t (CFDI 4.0 SAT)
      const cfdiValues = [
        'S01', 'CP01', 'CN01',
        'I03', 'I04', 'I05', 'I06', 'I07', 'I08',
        'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10',
        'G01', 'G02', 'G03', 'I01', 'I02', 'P01'
      ];
      for (const val of cfdiValues) {
        try {
          await client.query(`ALTER TYPE uso_cfdi_t ADD VALUE IF NOT EXISTS '${val}';`);
        } catch {
          // Ya existe o no necesario
        }
      }
    } catch (colErr) {
      console.warn('Aviso al verificar esquema de FACTURA:', colErr.message);
    } finally {
      release(); // libera el cliente de vuelta al pool
    }
    
  }
});

export default pool;