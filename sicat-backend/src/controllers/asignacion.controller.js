import pool from '../db/pool.js';
import { publish } from '../services/eventBus.js';


export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, pr.nombre AS producto, pr.marca,
             COALESCE(pm.descripcion_material, pr.nombre) AS material_solicitado,
             pm.cantidad_solicitada, pm.estatus AS pedido_estatus,
             a.es_devolvible,
             d.nombre AS departamento,
             dorig.nombre AS departamento_origen
      FROM ASIGNACION a
      JOIN INVENTARIO        i     ON a.id_inventario      = i.id_inventario
      LEFT JOIN PRODUCTO     pr    ON i.id_producto         = pr.id_producto
      LEFT JOIN CATEGORIA    c     ON pr.id_categoria       = c.id_categoria
      LEFT JOIN PEDIDO_MATERIAL pm ON a.id_pedido = pm.id_pedido
      JOIN DEPARTAMENTO      d     ON a.id_departamento     = d.id_departamento
      LEFT JOIN DEPARTAMENTO dorig ON i.id_departamento     = dorig.id_departamento
      ORDER BY a.fecha_asignacion DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function create(req, res) {
  const { id_inventario, id_departamento, id_pedido, condicion, es_devolvible = false } = req.body;
  const cantidadSolicitada = req.body.cantidad == null ? 1 : Number(req.body.cantidad);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener registro del inventario de origen
    const { rows: [inv] } = await client.query(
      `SELECT i.*, c.tipo AS tipo_producto
       FROM INVENTARIO i
       JOIN PRODUCTO p ON p.id_producto = i.id_producto
       LEFT JOIN CATEGORIA c ON c.id_categoria = p.id_categoria
       WHERE i.id_inventario = $1 FOR UPDATE OF i`, [id_inventario]
    );
    if (!inv) throw new Error('Inventario de origen no encontrado');
    if (inv.id_departamento !== 1) throw new Error('Solo el inventario de Sistemas puede asignarse');

    let cantidad = cantidadSolicitada;
    let pedido = null;
    if (id_pedido) {
      const { rows } = await client.query(
        'SELECT * FROM PEDIDO_MATERIAL WHERE id_pedido = $1 FOR UPDATE', [id_pedido]
      );
      pedido = rows[0];
      if (!pedido) throw new Error('Solicitud no encontrada');
      if (pedido.estatus !== 'PENDIENTE') throw new Error('La solicitud ya fue atendida');
      cantidad = Number(pedido.cantidad_solicitada);
      if (pedido.id_departamento === 1) throw new Error('Sistemas no puede solicitar material a sí mismo');
    }
    if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('La cantidad debe ser un entero positivo');
    if (inv.cantidad_disponible < cantidad && inv.cantidad_disponible > 0) throw new Error('Stock insuficiente para atender la solicitud');
    if (inv.cantidad_disponible === 0) throw new Error('No hay stock disponible para asignar');

    // 2. Descontar la cantidad asignada del inventario de Sistemas.
    await client.query(
      'UPDATE INVENTARIO SET cantidad_disponible = cantidad_disponible - $1 WHERE id_inventario = $2',
      [cantidad, id_inventario]
    );

    const destDeptoId = Number(id_departamento);
    if (!destDeptoId) throw new Error('El departamento destino es obligatorio');
    if (destDeptoId === 1) throw new Error('Sistemas no puede ser el departamento destino');

    // Ya no se actualiza destinatario de inventario,


    const { rows: [asig] } = await client.query(`
      INSERT INTO ASIGNACION (id_inventario, id_departamento, id_pedido, cantidad, condicion, es_devolvible, estatus)
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO') RETURNING *
    `, [id_inventario, destDeptoId, id_pedido || null, cantidad, condicion || null, Boolean(es_devolvible)]);

    if (pedido) {
      await client.query(
        `UPDATE PEDIDO_MATERIAL SET estatus = 'ENTREGADO' WHERE id_pedido = $1`,
        [pedido.id_pedido]
      );
    }

    await client.query('COMMIT');
    publish('assignment.created', asig);
    res.status(201).json(asig);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
}

export async function devolver(req, res) {
  const { condicion } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');


    const { rows: [asig] } = await client.query(
      'SELECT * FROM ASIGNACION WHERE id_asignacion = $1 FOR UPDATE',
      [req.params.id]
    );
    /*
    const { rows: [asig] } = await client.query(`
      SELECT a.*, i.id_producto, i.id_departamento AS id_departamento_origen, c.tipo AS tipo_producto
      FROM ASIGNACION a
      JOIN INVENTARIO i ON a.id_inventario = i.id_inventario
      JOIN PRODUCTO p ON p.id_producto = i.id_producto
      LEFT JOIN CATEGORIA c ON c.id_categoria = p.id_categoria
      WHERE a.id_asignacion = $1
    `, [req.params.id]);
*/
    if (!asig) throw new Error('Asignación no encontrada');
    if (asig.estatus === 'DEVUELTO') throw new Error('Ya fue devuelta');
    if (!asig.es_devolvible) throw new Error('Esta asignación fue registrada como no devolvible');
    const cantidad = Number(asig.cantidad) || 1;

    // 1. Marcar como devuelto
    await client.query(`
      UPDATE ASIGNACION
      SET estatus = 'DEVUELTO', fecha_devolucion = CURRENT_DATE,
          condicion = COALESCE($1, condicion)
      WHERE id_asignacion = $2
    `, [condicion, req.params.id]);

    // 2. sumar la cantidad devuelta al inventario de origen
    
    await client.query(
      'UPDATE INVENTARIO SET cantidad_disponible = cantidad_disponible + $1 WHERE id_inventario = $2',
      [cantidad, asig.id_inventario]
    );

    await client.query('COMMIT');
    publish('assignment.returned', { id_asignacion: req.params.id });
    res.json({ mensaje: 'Devolución registrada correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
}