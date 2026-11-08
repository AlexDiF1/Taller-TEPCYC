# Taller-TEPCYC

Aplicacion web para TODOENPCYCONSOLAS (taller de consolas, controles y celulares).

## Arquitectura (100% en el VPS)

Un solo proceso Node (`taller-tepcyc` en PM2, puerto **3005**) sirve:

| Ruta | Contenido |
|------|-----------|
| `/` , `/ingreso`, `/comprobantes` | Frontend Next.js compilado |
| `/api/*` | API REST (Express) |
| `/uploads/*` | Fotos de los equipos (estáticas) |
| `/api/health` | Estado y conteos de la base |

- **Base de datos**: SQLite (`better-sqlite3`) en `TallerTEPCYC APP/data/taller.db`
  con las tablas `customers`, `orders`, `order_items`, `order_photos`, `status_events`,
  `invoices` y `sales`.
- **Fotos**: se comprimen en el navegador (`lib/image.ts`, máx. 1280 px, JPEG 0.72)
  y se suben a `/api/uploads`, que las guarda en `TallerTEPCYC APP/uploads/`.
- **Facturas**: se generan solas — `R-<orden>` al registrar el ingreso y `E-<orden>`
  al pasar la orden a `completada`.
- **Estados**: `pendiente`, `enRevision`, `esperandoConfirmacion`, `completada`,
  `rechazada`, `fallida`.

## Comandos

```bash
pnpm install
pnpm build            # compila el frontend (next build)
pnpm start            # arranca el servidor único (PORT=3005)
pnpm dev              # desarrollo (NODE_ENV=development, mismo servidor)
pnpm db:import        # importa a SQLite el respaldo de Firestore (firestore-backup/)
```

`.env` opcional: `PORT` (3005), `HOST` (0.0.0.0), `DB_PATH`, `UPLOADS_DIR`, `DATA_DIR`.
