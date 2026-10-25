# API Estética Integral (backend)

Backend REST en **Node.js + Express + Prisma + SQL Server** para gestionar una estética integral:
clientes, profesionales, servicios y categorías, horarios, turnos, pagos y usuarios administrativos.
Solo backend: el frontend se conecta después a estos endpoints.

## Puesta en marcha

Requisitos: Node 18+ y Docker (o un SQL Server accesible).

```bash
npm install
cp .env.example .env            # editar JWT_SECRET, ADMIN_EMAIL y ADMIN_PASSWORD
docker compose up -d            # SQL Server 2022 en localhost:1433
npx prisma migrate dev --name init   # crea la base y genera la migración inicial
npm run seed                    # categorías, servicios de ejemplo y usuario administrador
npm run dev                     # http://localhost:3000  ·  Swagger en /api/docs
```

La carpeta `prisma/migrations` se genera con el primer `migrate dev`; versionala en git.
En producción: `npx prisma migrate deploy` y `npm start`.

### Tests

```bash
cp .env.test.example .env.test  # base "estetica_test" (los tests BORRAN sus datos; el nombre debe incluir "test")
npm run test:prepare            # crea/resetea el esquema de la base de pruebas
npm test
```

Cubren: autenticación y roles, catálogo (categorías/servicios/profesionales/horarios), disponibilidad,
reserva de turnos (servicio no ofrecido, fuera de horario, superposición, concurrencia, reprogramación),
estados, pagos (parcial, exceso, anulación, saldo) y utilidades de fecha.

## Estructura

```
prisma/schema.prisma      modelos y relaciones      prisma/seed.js   datos iniciales
src/config/               env (validado con Zod) y cliente Prisma
src/middlewares/          auth (JWT + roles), validate (Zod), manejo de errores
src/routes/               un archivo por recurso (rutas + validaciones)
src/services/             reglas de negocio de turnos, disponibilidad y pagos
src/utils/                fechas/zona horaria, paginación, AppError
src/docs/openapi.js       especificación OpenAPI -> /api/docs
tests/                    Jest + Supertest
```

## Modelo de datos

`Categoria 1—N Servicio` · `Profesional N—N Servicio` (tabla `ProfesionalServicio`, con precio/duración
propios opcionales) · `Profesional 1—N Horario` · `Cliente/Profesional/Servicio 1—N Turno` · `Turno 1—N Pago`.

**Cada profesional solo puede atender los servicios que se le asignan**
(`PUT /profesionales/:id/servicios`); reservar otro servicio devuelve 422 `PROFESIONAL_SIN_SERVICIO`.

## Endpoints (prefijo `/api`)

| Recurso | Endpoints | Quién |
|---|---|---|
| Sistema | `GET /health` | público |
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/cambiar-password` | login público |
| Usuarios | CRUD `/usuarios` | ADMIN |
| Categorías | `GET` (todos) · `POST/PATCH/DELETE /categorias` | escritura ADMIN |
| Servicios | CRUD `/servicios`, `GET /servicios/:id/profesionales` | escritura ADMIN |
| Profesionales | CRUD `/profesionales`, `GET/PUT /:id/servicios`, `GET/PUT /:id/horarios` | escritura ADMIN |
| Clientes | CRUD `/clientes`, `GET /clientes/:id/turnos` | ADMIN y RECEPCION |
| Disponibilidad | `GET /disponibilidad?profesionalId&servicioId&fecha=YYYY-MM-DD` | autenticado |
| Turnos | `GET/POST /turnos`, `GET/PATCH /turnos/:id`, `PATCH /turnos/:id/estado` | ADMIN y RECEPCION |
| Pagos | `GET/POST /pagos`, `GET /pagos/:id`, `PATCH /pagos/:id/anular`, `GET /pagos/resumen` | anular y resumen: ADMIN |

Autenticación: `Authorization: Bearer <token>`. Errores: `{ "error": { "code", "message", "details?" } }`.
Listados grandes paginan con `?page=&limit=` → `{ data, meta }`.

## Reglas de negocio importantes

- **Turnos**: el profesional debe realizar el servicio, el turno debe caer dentro de una franja de su horario
  semanal, no puede superponerse con otro turno no cancelado, y debe ser a futuro. Se valida dentro de una
  transacción `Serializable` para evitar doble reserva simultánea.
- **Precio y duración**: salen del servicio, o del precio/duración especial del profesional. El precio se
  congela en el turno (cambios posteriores del catálogo no alteran turnos ya reservados).
- **Estados de turno**: `PENDIENTE → CONFIRMADO/COMPLETADO/CANCELADO/AUSENTE`, `CONFIRMADO → COMPLETADO/CANCELADO/AUSENTE`.
  Cancelar libera el horario.
- **Pagos**: se permiten señas y pagos parciales; la suma de pagos vigentes no puede superar el precio.
  Los pagos no se borran, se anulan (queda el rastro).
- **Borrados**: categorías con servicios, y servicios/profesionales/clientes con turnos, no se eliminan (409);
  se desactivan con `PATCH`, preservando el historial.
- **Zona horaria**: todo se guarda en UTC. Los horarios de atención son hora local según
  `TZ_OFFSET_MINUTES` (Argentina: `-180`). Los instantes enviados deben incluir zona
  (`2025-06-10T15:00:00-03:00`). Los montos se devuelven como string decimal (`"12000.00"`).

## Seguridad

Contraseñas con bcrypt, JWT HS256 con vencimiento, el usuario se revalida en cada request (desactivar corta
el acceso al instante), rate limit en login, Helmet, CORS configurable, límite de tamaño de body, validación
estricta con Zod, consultas parametrizadas por Prisma y mensajes de error genéricos en producción.

## Notas sobre SQL Server + Prisma

Se usa Prisma 6 (fijado con `^6`) con `provider = "sqlserver"`. Limitaciones y cómo se resolvieron:
sin `enum` (estados como `String` validados con Zod), `@unique` con `NVarChar` acotado (límite de 900 bytes
de índice), `NoAction` en lugar de `Restrict`, sin únicos sobre columnas opcionales. Si más adelante
se prefiere PostgreSQL/MySQL, basta cambiar el `provider`, la `DATABASE_URL` y los `@db.*` del esquema.

## Datos de ejemplo

`npm run seed` es idempotente y no pisa cambios: carga las 11 categorías pedidas con servicios y **precios
de ejemplo** (editables por la API) y el administrador definido en `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## Ideas para ampliar

Bloqueos y vacaciones de profesionales, recordatorios por WhatsApp/email, comisiones, productos y stock,
fichas de clientes con historial/fotos, reserva pública online (hoy `disponibilidad` requiere token),
caja diaria y reportes, auditoría de cambios.
