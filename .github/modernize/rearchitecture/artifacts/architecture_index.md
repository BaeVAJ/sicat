# SICAT — Architecture Index

This index is not the full contract. Do not implement from this file alone; follow the artifact paths below.

## Implementation Guide

### Global artifacts

- `project-structure.md`: functional domains, layers and runtime entrypoints.
- `tech-stack.md`: existing frameworks, versions, dependencies and runtime configuration.
- `data-model.md`: PostgreSQL entities, relationships, enums and transaction notes.
- `unit_graph.yaml`: unit boundaries, source anchors, dependencies, signatures and shared references.
- `migration_boundary.yaml`: this request is documentation-only; `must_rewrite` is empty.
- `wire_contracts.yaml`: filter by `unit`; preserve frozen REST, multipart and SSE contracts.
- `shared_modules.yaml`: filter `used_by_units`; use the listed fields only.
- `cross_unit_state.yaml`: filter by `writer.unit` or `reader.unit`; preserve cookie/event flows.
- `seams.yaml`: filter `cut_between`; inferred seams are advisory, but frozen-side rules protect API and Storage contracts.

### Units

Each unit has `behavior.yaml`, `bindings.yaml` and `unit_decomposition.yaml`. Read the unit graph row first, then filter global artifacts by the unit name. `unit_decomposition.yaml` contains candidates only and always has `commit: false`.

| Unit | External trigger | Unit artifacts |
|---|---|---|
| `frontend-spa` | React Router pages | `units/frontend-spa/*` |
| `auth-api` | `/api/auth/*` | `units/auth-api/*` |
| `asignaciones-api` | `/api/asignaciones/*` | `units/asignaciones-api/*` |
| `categorias-api` | `/api/categorias/*` | `units/categorias-api/*` |
| `departamentos-api` | `/api/departamentos/*` | `units/departamentos-api/*` |
| `compras-api` | `/api/compras/*` | `units/compras-api/*` |
| `empresas-api` | `/api/empresas/*` | `units/empresas-api/*` |
| `facturas-api` | `/api/facturas/*` | `units/facturas-api/*` |
| `inventario-api` | `/api/inventario/*` | `units/inventario-api/*` |
| `pedidos-api` | `/api/pedidos/*` | `units/pedidos-api/*` |
| `productos-api` | `/api/productos/*` | `units/productos-api/*` |
| `proveedores-api` | `/api/proveedores/*` | `units/proveedores-api/*` |
| `tickets-api` | `/api/tickets/*` | `units/tickets-api/*` |
| `usuarios-api` | `/api/usuarios/*` | `units/usuarios-api/*` |
| `events-api` | `/api/events/stream` | `units/events-api/*` |

### Completion evidence

Any implementation agent must report: artifact paths read; each `must_preserve` and `must_appear_in_target` item implemented; unresolved/deferred contracts; and build, lint, test or runtime evidence.
