import pool from './pool.js';

async function migrate() {
  const client = await pool.connect();
  try {
    // El estado de una factura PPD también debe recalcularse cuando cambian sus
    // montos o método de pago (no solo cuando se registran pagos). Se reutiliza
    // la función creada en la migración de estado de cuenta PPD.
    await client.query('DROP TRIGGER IF EXISTS trg_recalcular_estado_factura_ppd_montos ON FACTURA;');
    await client.query(`
      CREATE TRIGGER trg_recalcular_estado_factura_ppd_montos
      AFTER INSERT OR UPDATE OF monto_subtotal, monto_iva, metodo_pago ON FACTURA
      FOR EACH ROW EXECUTE FUNCTION fn_recalcular_estado_factura_ppd();
    `);
    console.log('✓ Trigger trg_recalcular_estado_factura_ppd_montos creado en FACTURA');

    // Backfill de consistencia: recalcular el estado de las facturas PPD existentes
    const { rowCount } = await client.query(`
      UPDATE FACTURA f
      SET estado = CASE
        WHEN t.total > 0 AND t.pagado >= t.total THEN 'PAGADO'::estado_factura_t
        WHEN t.pagado > 0 THEN 'PAGO_PARCIAL'::estado_factura_t
        ELSE 'PENDIENTE'::estado_factura_t
      END
      FROM (
        SELECT f2.id_factura,
               COALESCE(f2.monto_subtotal, 0) + COALESCE(f2.monto_iva, 0) AS total,
               COALESCE(SUM(d.monto_pago), 0) AS pagado
        FROM FACTURA f2
        LEFT JOIN DETALLES_FACTURA d ON d.id_factura = f2.id_factura
        WHERE f2.metodo_pago = 'PPD'::metodo_pago_t AND f2.estado <> 'CANCELADO'::estado_factura_t
        GROUP BY f2.id_factura
      ) t
      WHERE f.id_factura = t.id_factura
        AND f.estado IS DISTINCT FROM (
          CASE
            WHEN t.total > 0 AND t.pagado >= t.total THEN 'PAGADO'::estado_factura_t
            WHEN t.pagado > 0 THEN 'PAGO_PARCIAL'::estado_factura_t
            ELSE 'PENDIENTE'::estado_factura_t
          END
        );
    `);
    console.log(`✓ Backfill de consistencia completado (${rowCount} factura(s))`);
    console.log('Migración trigger de estado en FACTURA completada con éxito.');
  } catch (error) {
    console.error('Error en migración trigger de estado en FACTURA:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
