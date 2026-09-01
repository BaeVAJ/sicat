import pool from './pool.js';

async function migrate() {
  const client = await pool.connect();
  const cfdiValues = [
    'S01', 'CP01', 'CN01',
    'I03', 'I04', 'I05', 'I06', 'I07', 'I08',
    'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10',
    'G01', 'G02', 'G03', 'I01', 'I02', 'P01'
  ];

  console.log('Migrando tipos ENUM de uso_cfdi_t...');
  for (const val of cfdiValues) {
    try {
      await client.query(`ALTER TYPE uso_cfdi_t ADD VALUE IF NOT EXISTS '${val}';`);
      console.log(`✓ Valor '${val}' agregado/verificado`);
    } catch (e) {
      console.warn(`Aviso con '${val}':`, e.message);
    }
  }

  // Asegurar columna archivo_xml_url en FACTURA
  try {
    await client.query('ALTER TABLE FACTURA ADD COLUMN IF NOT EXISTS archivo_xml_url TEXT;');
    console.log('✓ Columna archivo_xml_url verificada en FACTURA');
  } catch (e) {
    console.warn('Aviso con archivo_xml_url:', e.message);
  }

  client.release();
  console.log('¡Migración de enums completada con éxito!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Error en migración:', err);
  process.exit(1);
});
