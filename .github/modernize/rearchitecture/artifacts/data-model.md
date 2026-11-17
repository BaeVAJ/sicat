# SICAT — Modelo de datos existente

## Entidades y relaciones

- `EMPRESA(id_empresa)`: organización propietaria; tiene muchos `DEPARTAMENTO` y `COMPRA`.
- `DEPARTAMENTO(id_departamento)`: unidad organizacional; pertenece a `EMPRESA`, y es referenciada por usuarios, inventario, asignaciones, pedidos y tickets.
- `CATEGORIA(id_categoria)`: clasificación de productos mediante `tipo_categoria_t`.
- `PRODUCTO(id_producto)`: artículo de catálogo; pertenece a una categoría y participa en detalle de compras, inventario y pedidos.
- `PROVEEDOR(id_proveedor)`: proveedor con email único y `tipo_pago_t`; participa en compras.
- `USUARIOS(id_usuario)`: cuenta autenticada; pertenece opcionalmente a un departamento, guarda rol y estatus de empleado.
- `COMPRA(id_compra)`: cabecera de compra vinculada a proveedor y empresa; tiene muchos `DETALLE_COMPRA` y puede tener una `FACTURA`.
- `DETALLE_COMPRA(id_compra,id_producto)`: relación compuesta entre compra y producto con cantidad y precio unitario.
- `FACTURA(id_factura)`: CFDI asociado opcionalmente a compra; guarda UUID, RFC, importes, método de pago, uso CFDI, estado y URLs.
- `DETALLES_FACTURA(id_detalle_factura)`: pagos/complementos de una factura; eliminación en cascada al borrar la factura.
- `CODIGO_PAGO(codigo_pago)`: catálogo de códigos de pago.
- `INVENTARIO(id_inventario)`: existencia de un producto en un departamento; unicidad por `(id_producto,id_departamento)`.
- `PEDIDO_MATERIAL(id_pedido)`: solicitud de material de un departamento y producto; puede ser atendida por asignaciones.
- `ASIGNACION(id_asignacion)`: entrega/asignación de inventario a un departamento, opcionalmente ligada a un pedido; soporta devolución.
- `TICKETS(id_ticket)`: solicitud de soporte de un usuario/departamento con estado, urgencia y fechas.

## Enums

`estado_pago_t`, `tipo_pago_t`, `tipo_categoria_t`, `estado_ticket_t`, `metodo_pago_t`, `uso_cfdi_t`, `estatus_asig_t`, `estatus_pedido_t`, `rol_t`, `estatus_empleado`.

## Integridad y transacciones

- Las relaciones se protegen con claves foráneas; `DETALLES_FACTURA` usa `ON DELETE CASCADE`.
- `INVENTARIO` impide duplicar producto/departamento.
- Las migraciones de complementos ejecutan `BEGIN`/`COMMIT` y hacen `ROLLBACK` ante error.
- `pool.js` verifica/agrega `FACTURA.archivo_xml_url` y valores del enum CFDI al iniciar.
