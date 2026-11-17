import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pool from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// El seed del catálogo vive en el proyecto de base de datos
const SEED_CODIGO_PAGO = path.resolve(__dirname, '../../../sicat-database/seed_codigo_pago.sql');

async function migrate() {
  const client = await pool.connect();
  try {
    // 1. Asegurar el valor de enum que usa el trigger/backfill.
    //    En esta BD el tipo se llama estado_factura_t (no estado_pago_t).
    try {
      await client.query("ALTER TYPE estado_factura_t ADD VALUE IF NOT EXISTS 'PAGO_PARCIAL';");
      console.log("✓ Valor 'PAGO_PARCIAL' verificado en estado_factura_t");
    } catch (e) {
      console.warn('Aviso con PAGO_PARCIAL:', e.message);
    }

    // 2. Catálogo de formas de pago (CODIGO_PAGO). Idempotente.
    try {
      const seedSql = await readFile(SEED_CODIGO_PAGO, 'utf8');
      await client.query(seedSql);
      console.log('✓ Catálogo CODIGO_PAGO cargado desde sicat-database/seed_codigo_pago.sql');
    } catch (e) {
      console.warn('Aviso al cargar el seed de CODIGO_PAGO:', e.message);
    }

    // 3a. Normalizar num_pago duplicados (solo facturas con repetidos entre
    //     valores no nulos). Idempotente: sin duplicados, no actualiza nada.
    const { rowCount: renumerados } = await client.query(`
      WITH dup AS (
        SELECT id_factura
        FROM DETALLES_FACTURA
        WHERE num_pago IS NOT NULL
        GROUP BY id_factura
        HAVING COUNT(*) <> COUNT(DISTINCT num_pago)
      )
      UPDATE DETALLES_FACTURA d
      SET num_pago = r.nuevo
      FROM (
        SELECT id_detalle_factura,
               ROW_NUMBER() OVER (
                 PARTITION BY id_factura
                 ORDER BY num_pago, fecha_pago, id_detalle_factura
               ) AS nuevo
        FROM DETALLES_FACTURA
        WHERE num_pago IS NOT NULL
          AND id_factura IN (SELECT id_factura FROM dup)
      ) r
      WHERE d.id_detalle_factura = r.id_detalle_factura
        AND d.num_pago IS DISTINCT FROM r.nuevo;
    `);
    if (renumerados) {
      console.log(`✓ num_pago normalizados en ${renumerados} detalle(s) con duplicados`);
    }

    // 3b. Un número de pago no puede repetirse dentro de la misma factura.
    try {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_detalle_factura_num_pago') THEN
            ALTER TABLE DETALLES_FACTURA
              ADD CONSTRAINT uq_detalle_factura_num_pago UNIQUE (id_factura, num_pago);
          END IF;
        END $$;
      `);
      console.log('✓ Constraint único (id_factura, num_pago) creado/verificado');
    } catch (e) {
      const { rows } = await client.query(`
        SELECT id_factura, num_pago, COUNT(*)::int AS n
        FROM DETALLES_FACTURA
        WHERE num_pago IS NOT NULL
        GROUP BY id_factura, num_pago
        HAVING COUNT(*) > 1
        ORDER BY id_factura, num_pago
      `);
      console.warn('⚠ No se pudo crear el constraint único (id_factura, num_pago):', e.message);
      if (rows.length) {
        console.warn('  Duplicados restantes (id_factura, num_pago, veces):');
        rows.forEach((r) => console.warn(`   - factura ${r.id_factura}, pago ${r.num_pago} → ${r.n}`));
      }
    }

    // 4. Función que recalcula el estado de una factura PPD según sus pagos
    await client.query(`
      CREATE OR REPLACE FUNCTION fn_recalcular_estado_factura_ppd()
      RETURNS trigger AS $$
      DECLARE
        v_id     INT := COALESCE(NEW.id_factura, OLD.id_factura);
        v_metodo metodo_pago_t;
        v_estado estado_factura_t;
        v_total  NUMERIC(10,2);
        v_pagado NUMERIC(10,2);
        v_nuevo  estado_factura_t;
      BEGIN
        SELECT metodo_pago, estado,
               COALESCE(monto_subtotal, 0) + COALESCE(monto_iva, 0)
          INTO v_metodo, v_estado, v_total
        FROM FACTURA
        WHERE id_factura = v_id;

        IF NOT FOUND OR v_metodo IS DISTINCT FROM 'PPD'::metodo_pago_t THEN
          RETURN NULL;
        END IF;

        IF v_estado = 'CANCELADO'::estado_factura_t THEN
          RETURN NULL;
        END IF;

        SELECT COALESCE(SUM(monto_pago), 0)
          INTO v_pagado
        FROM DETALLES_FACTURA
        WHERE id_factura = v_id;

        IF v_total > 0 AND v_pagado >= v_total THEN
          v_nuevo := 'PAGADO';
        ELSIF v_pagado > 0 THEN
          v_nuevo := 'PAGO_PARCIAL';
        ELSE
          v_nuevo := 'PENDIENTE';
        END IF;

        IF v_estado IS DISTINCT FROM v_nuevo THEN
          UPDATE FACTURA SET estado = v_nuevo WHERE id_factura = v_id;
        END IF;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✓ Función fn_recalcular_estado_factura_ppd creada');

    // 5. Trigger sobre DETALLES_FACTURA (alta, edición y baja de pagos)
    await client.query('DROP TRIGGER IF EXISTS trg_recalcular_estado_factura_ppd ON DETALLES_FACTURA;');
    await client.query(`
      CREATE TRIGGER trg_recalcular_estado_factura_ppd
      AFTER INSERT OR UPDATE OR DELETE ON DETALLES_FACTURA
      FOR EACH ROW EXECUTE FUNCTION fn_recalcular_estado_factura_ppd();
    `);
    console.log('✓ Trigger trg_recalcular_estado_factura_ppd creado');

    // 6. Backfill: recalcular el estado de las facturas PPD existentes
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
    console.log(`✓ Backfill de estados PPD completado (${rowCount} factura(s) actualizada(s))`);

    console.log('Migración PPD "estado de cuenta" completada con éxito.');
  } catch (error) {
    console.error('Error en migración PPD estado de cuenta:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
