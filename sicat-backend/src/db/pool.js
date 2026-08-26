import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // ESTO ES OBLIGATORIO PARA SUPABASE 👇
  ssl: { 
    rejectUnauthorized: false 
  }
});

// Prueba rápida al iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.stack);
  } else {
    console.log('¡Conexión exitosa a Supabase PostgreSQL!');
    release(); // libera el cliente de vuelta al pool
  }
});

export default pool;