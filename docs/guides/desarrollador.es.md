# Futurar para desarrolladores

Onboarding técnico del proyecto: qué construimos, cómo llegó a su forma actual, cómo se
trabaja acá y —lo más importante— cómo funcionan el backend, la IA y Supabase. Si vas a
tocar código en este repo, leé esto antes que nada.

> Última revisión: 2026-10-12 · Fuente de verdad: [`AGENTS.md`](../../AGENTS.md),
> [`MEMORY.md`](../../MEMORY.md), [`plan.md`](../../plan.md),
> [`docs/architecture/overview.md`](../architecture/overview.md) y los [specs](../specs/).

---

## Camino rápido (tu primer día)

1. Leé, en este orden: `AGENTS.md` → `MEMORY.md` → `plan.md` → este documento.
2. Prepará el entorno: `npm ci` en la raíz y `npm install` en `backend/`.
3. Verificá que arranca:
   ```bash
   npm run typecheck && npm run check:supabase && npm test
   cd backend && npm run build && npx jest
   ```
4. Leé el [SPEC más reciente](../specs/SPEC-034.md) para ver el formato con el que se
   especifica cada cambio.
5. Para tu primer cambio: escribí un SPEC, esperá aprobación, y recién ahí codeá. Ver
   [Cómo se trabaja acá](#4-cómo-se-trabaja-acá).

---

## 1. Qué es Futurar y para quién

Plataforma **accesible asistida por IA** donde personas con **discapacidad motriz severa**
crean, guardan y dedican productos digitales. Cuatro verticales, sobre el mismo framework:

| Vertical | Qué produce | Backend | Frontend |
|---|---|---|---|
| Libros | Cuentos ilustrados (luego EPUB) | `src/books` + `ai/application/book-*` | `StoryReader`, `bookGeneration.ts` |
| Diseños | Flyers (luego PDF) | `src/designs` + `design-*` | `backendDesigns.ts` |
| Presentaciones | Decks verticales | `src/presentations` + `presentation-*` | `backendPresentations.ts` |
| Comunicación | Tableros AAC que hablan | `src/communications` + `communication-*` | `backendCommunications.ts` |

Tres tipos de usuario:

| Rol | Qué hace | Dónde |
|---|---|---|
| **Alumno** | Crea con switch único o input directo. Ve solo lo que el docente habilitó | `StudentApp`, `ScanningGrid`, `StoryReader` |
| **Docente** | Perfiles, catálogo de acciones/opciones, contactos, claves de IA, selección de modelo | `TeacherPanel`, `StudentEditor`, `ApiKeyPanel`, `AiModelPanel` |
| **Fundación / tenant** | Agrupa docentes. El modelo multi-fundación está reservado (`tenant_id`) | Roles + `ai_credentials` |

**El barrido por switch único no es una feature opcional: es el núcleo del producto.** Toda
decisión de UI de alumno se toma pensando en acceso por un solo pulsador.

Estándares objetivo: **WCAG 2.2 AA**, **ISO/IEC 17549-3** (switch), **EN 301 549**. La UI es
**es-AR**; el código, los identificadores, los comentarios y los commits son **en inglés**.

---

## 2. El proyecto en números

Todo lo de abajo es verificable con `git ls-tree` y un `Get-ChildItem` sobre `dev`.

| Área | Cantidad |
|---|---|
| Archivos versionados | 483 |
| `backend/src` | 255 archivos (183 sin contar specs) |
| Módulos NestJS | 11 |
| Controllers | 14 |
| Rutas bajo `/api/v1` | 59 |
| Migraciones Supabase | 16 (`0000` → `0015`) |
| ADRs | 6 (`docs/adr/`) |
| SPECs escritos | 37 (`docs/specs/`) |
| Componentes React | 26 `.tsx` |
| Clientes de backend (`services/`) | 15 |
| Tests backend | 72 suites / 390 tests |
| E2E backend | 9 specs |
| Tests frontend | 33 archivos / 159 tests |
| E2E frontend | 8 specs Playwright × 2 dispositivos |
| Jobs de CI | 4 |

---

## 3. De dónde venimos: `main` (feb 2026) vs `dev` (hoy)

`main` está **congelada a propósito**: es una foto del prototipo original y se actualiza
recién al cerrar una fase. Comparar contra ella mide la magnitud del cambio, no un refactor.

| | `main` — 11 feb 2026 | `dev` — hoy |
|---|---|---|
| Commits / archivos | 3 commits · 66 archivos | +55 commits · 483 archivos |
| Origen | Export de **Google AI Studio** (`metadata.json`) | Arquitectura propia |
| Backend | NestJS **11**, 17 archivos, código muerto | NestJS **12**, 255 archivos, dueño de datos e IA |
| ¿La IA dónde corre? | **En el navegador**, 5 proveedores | **Solo en el backend** |
| Claves de IA | `localStorage` + inyectadas en el bundle | Cifradas AES-256-GCM, por tenant |
| Supabase | Frontend leía y escribía tablas | Frontend solo Auth; backend dueño de datos |
| Barrido | Existía, con `click` (mouseup) | `pointerdown` gana al foco, por perfil |
| i18n | Ninguna (strings inline) | `utils/messages.ts` con `t()` |
| Tests | **0** | 549 (159 frontend + 390 backend) |
| CI | **Ninguno** | 4 jobs requeridos |

### Qué era `main`, concretamente

Era un prototipo exportado de AI Studio, no un proyecto diseñado. Los problemas que definen
la arquitectura actual:

- `services/ai.ts` (437 líneas) llamaba a **Gemini, OpenAI, Anthropic, Groq y Together
  desde el navegador**, con las claves salidas de `localStorage['futurar_ai_config']` o de
  `import.meta.env.VITE_GEMINI_API_KEY`.
- `vite.config.ts` **inyectaba `GEMINI_API_KEY` en el bundle del cliente**.
- El backend Nest 11 existía, pero **la clave viajaba en el body de cada request**
  (`dto.apiKey`). No era un dueño de secretos: era un pasamanos sin auth ni persistencia.
- **El frontend nunca referenciaba el puerto 3001.** Ese backend era código muerto.
- El frontend leía y escribía `students`, `stories`, `usage_sessions`, `ai_config` y
  `teachers` directo contra Supabase con la clave anon.
- `.env` **estaba commiteado**; el `.gitignore` solo ignoraba `*.local`.
- Cero tests, cero CI.

Lo rescatable era el barrido: `ScanningGrid` con un `setInterval` de 3000 ms. Pero todo se
disparaba con `click` y un clic en vacío activaba el ítem enfocado.

### Qué es `dev`, en una línea

Una reescritura donde el **backend es el único dueño de la IA y de los datos**, el frontend
es UI + Auth, y las decisiones de accesibilidad están codificadas en tests.

---

## 4. Cómo se trabaja acá

### Spec antes que código (SDD, no negociable)

No hay "vibe coding". Cada cambio arranca con un SPEC en `docs/specs/SPEC-NNN.md` que sigue
siempre el mismo formato:

```
# SPEC-NNN — Título
- Status / Phase / Depends on / Blocks
## Objective
## Why
## Current behavior (audit)     ← citas path:line del código real
## Decisions                    ← D1…Dn, la recomendada marcada
## Contract                     ← rutas, códigos, tipos
## File impact                  ← nuevo / tocado / fuera de alcance
## Acceptance criteria          ← checkboxes verificables
## Edge cases
## Out of scope
## Verification                 ← comandos exactos
## Versions                     ← versiones validadas, no inventadas
```

Se escribe el SPEC y **se frena**: se pide aprobación antes de tocar código.

### Ramas y merge

| Regla | Detalle |
|---|---|
| Rama de integración | `dev`. Protegida. **Nunca commit directo.** |
| Flujo | rama desde `dev` → PR a `dev` → **4 checks verdes** → **squash** → auto-delete |
| `main` | Congelada y protegida, 1 review. Se actualiza desde `dev` al cerrar fase |
| Rama al día | **El head del PR tiene que estar al día con su base**, o GitHub rechaza el merge |
| Historial | Lineal. Sin merge commits en `dev` |
| Un PR | Un SPEC |
| Después del merge | Un PR `docs(memory)` que marca el SPEC como mergeado |

### Commits

Conventional Commits, validados por `commitlint` en CI. **Sin `Co-Authored-By` ni
atribución de IA.** Tipos en uso: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`.

### Accesibilidad e i18n: no negociables

Si tu cambio toca UI de alumno, esto se revisa:

- Selección en **`pointerdown` sobre `[data-option]`**; el clic directo **siempre** gana al
  foco del barrido. **Nunca** se actúa al soltar.
- Targets ≥ 44×44 px; contraste de texto ≥ 4.5:1, de foco ≥ 3:1, foco siempre visible.
- Se respeta `prefers-reduced-motion` / `prefers-contrast`.
- **Nunca** se bloquea el scroll (`overflow-x` sí, `overflow: hidden` global no).
- Nada de `div`/`span` como botón; todo interactivo con nombre accesible.
- Nada de strings hardcodeados: van a `utils/messages.ts` (`t()` **lanza** si la clave no
  existe, a propósito).

### Artefactos vivos

| Archivo | Qué es | Regla |
|---|---|---|
| `MEMORY.md` | Estado compacto para agentes | **≤ 50 líneas**. Se poda |
| `plan.md` | Roadmap por fases y EPICs | Se actualiza al cerrar cada tarea |
| `docs/specs/` | El contrato de cada cambio | Un archivo por SPEC |
| `odd/tasks/` | Seguimiento de implementación | Uno por SPEC en curso |

---

## 5. El backend

NestJS 12 + TypeScript 6 (ESM, la app es CJS vía `require(esm)`). Prefijo global
`/api/v1` definido en `backend/src/app.setup.ts`.

### Módulos

| Módulo | Responsabilidad |
|---|---|
`app` | Raíz: config validada, throttler, filtros globales |
`ai` | Todo lo de IA, los 4 verticales, exports, credenciales, catálogo de modelos, jobs |
`books` | CRUD de libros, dedicatoria, favorito, soft delete |
`designs` | Flyers: listar, detalle, borrar |
`presentations` | Decks: listar, detalle, borrar |
`communications` | Tableros AAC: listar, detalle, borrar |
`actions` | Catálogo Acción → Opción → Ítem + permisos por perfil |
`profiles` | Perfiles, settings de accesibilidad, contactos |
`supabase` | Cliente Supabase (un solo lugar) |
`observability` | Pino, correlation ID, `/health`, `/metrics` |
`common/redis` | Cliente Redis (queue + idempotencia) |

### Autenticación

`SupabaseAuthGuard` valida el JWT con `client.auth.getUser(token)` y deja
`request.user = { id, email? }`. **No hay decorador `@CurrentUser`**: los controllers usan
`@Req()` y leen `request.user?.id`. Todo exige JWT de docente salvo dos excepciones:
`GET /profiles/active` (quiosco de alumnos, con `notes` excluidas por whitelist) y
`GET /health`.

### Errores

Envoltura única **`AiError`**: `{ statusCode, code, message, details? }`, aplicada por un
filtro global. Códigos que vas a ver: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`VALIDATION_FAILED`, `LIMIT_EXCEEDED` (422), `INVALID_OUTPUT` (502), `CONTENT_BLOCKED`
(422), `PROVIDER_UNAVAILABLE`, `AI_ENDPOINTS_DISABLED` (503).

`POST /ai/*/generate` acepta **`Idempotency-Key`** (store in-memory con TTL 24 h, o Redis
si hay `REDIS_URL`). Reintentar con la misma clave devuelve el job original.

### Jobs y streaming

| Pieza | Cómo funciona |
|---|---|
| Driver | `QUEUE_DRIVER=inline\|bullmq`. `bullmq` solo si hay `REDIS_URL` |
| Librería | **`bullmq` directo**, no `@nestjs/bullmq` (para mantener el driver condicional) |
| Reintentos | 3× con backoff exponencial |
| Circuit breaker | 5 fallos en 60 s |
| Repositorios | Versión **Supabase** y versión **in-memory**; los tests cubren la paridad |
| SSE | `GET /api/v1/ai/jobs/:id/events`, **auth por header** (no query string) |
| SSE detalles | polling server-side 1 s, heartbeat 15 s, cierra en estado terminal |
| Fallback | El cliente cae a polling si SSE no está disponible |

### Persistencia

`books` + `book_versions`: guardado **idempotente por `generation_job_id`**, auditoría por
versión (quién, cuándo, versión del prompt, costo), soft delete. Las imágenes son opcionales
(flag `BOOK_IMAGES_ENABLED`, default `false`) y viven en un bucket **privado**; al leer se
firman URLs con TTL configurable y **nunca se persisten**.

### Observabilidad

Logs JSON con `nestjs-pino` (nivel por `LOG_LEVEL`). **Correlation ID de punta a punta**: se
respeta `x-correlation-id` si llega, si no se genera un UUID, se devuelve en cada respuesta y
viaja `controller → comando → cola → runner` por todos los logs del job. Los headers de
credenciales se redactan. `/metrics` es solo para docentes y está en memoria (se reinicia en
cada deploy).

### Dos cosas que te van a morder

- **Swagger se configura antes de `app.listen`.** Express 5 no sirve rutas registradas
  después. Está en `/api/v1/docs`, apagado en producción.
- **`AI_ENDPOINTS_ENABLED` (default `false`).** Con el flag en `true`, el arranque **exige**
  `GEMINI_API_KEY` y las variables de Supabase, y si faltan el boot falla a propósito. Es
  deliberado: preferimos un error ruidoso a un 501 silencioso.

---

## 6. La IA

### La regla de oro

> **La IA nunca corre en el frontend.** Sin SDK, sin API key, sin prompt en el navegador.

El backend es dueño de claves, prompts, modelos, cuotas, validación, persistencia y
auditoría. Si un PR mete IA en el navegador, se rechaza. `npm run check:supabase` es la red
de seguridad parcial; el resto es revisión.

### Arquitectura: puertos y adaptadores

```
backend/src/ai/
├── domain/
│   ├── ports/{text-generator,image-generator,tts}.port.ts   ← interfaces
│   └── {book,design,presentation,communication,export}-generation.types.ts
├── infrastructure/
│   ├── gemini/{gemini-text,gemini-image,gemini-tts}.adapter.ts + gemini-client.provider.ts
│   └── openrouter/{openrouter-text,openrouter-image}.adapter.ts + openrouter-client.ts
├── tokens.ts                                                ← tokens de inyección
├── application/                                             ← casos de uso por vertical
├── prompts/<vertical>/v1/{*.prompt.ts,*.schema.ts}          ← prompts versionados
├── secrets/                                                 ← credenciales cifradas
└── guards/ai-endpoints-enabled.guard.ts
```

### Proveedores

| Proveedor | Texto | Imagen | TTS |
|---|---|---|---|
| Gemini | ✅ | ✅ | ✅ |
| OpenRouter | ✅ | ✅ | ❌ |

**TTS es solo Gemini.** OpenRouter queda detrás de un gate (`isOpenRouterEnabled()`) y solo
se elige si está habilitado; si no, se usa Gemini. Es una decisión de privacidad, no técnica.

### Un vertical, de punta a punta

Cada vertical repite la misma forma. Para `design`:

1. `generate-design-request.dto.ts` valida la entrada (`class-validator`, rechazo de claves
   desconocidas).
2. `design-generation.use-case.ts` orquesta; `design-generation.service.ts` resuelve
   defaults del perfil.
3. `design-prompt-builder.service.ts` arma el prompt desde `prompts/design/v1/`.
4. `design-generation.runner.ts` llama al adaptador (Gemini u OpenRouter).
5. `design-output.parser.ts` parsea tolerante, `design-output.validator.ts` valida contra el
   schema y modera por audiencia.
6. Se persiste. **Nada se persiste sin pasar el validador.**

Si agregás un vertical, copiá esa estructura. `generation-vertical.ts` la unifica.

### Credenciales cifradas

| Pieza | Detalle |
|---|---|
| Tabla | `ai_credentials` (migración `0004`) |
| Cifrado | **AES-256-GCM** con `AI_SECRETS_MASTER_KEY` (base64, 32 bytes) |
| Resolución | Por **tenant** y **por proveedor**: `GEMINI_API_KEY`→gemini, `OPENROUTER_API_KEY`→openrouter |
| Orden | Base de datos primero, `env` como fallback |
| Cache | Clientes cacheados por **hash de la key** → rotar no requiere reiniciar |
| API | Devuelve **solo metadata**, nunca la clave |
| Flag | `AI_CREDENTIALS_ENABLED`, default `false` |
| Falla ruidosa | Una fila **existente pero ilegible** revienta; solo una fila ausente o revocada cae a `env` |

### Selección de modelo por docente

Catálogo **curado** (allowlist) en `model-catalog.controller.ts` +
`model-selection.service.ts`, migración `0014`. El docente elige de la lista; no puede
inyectar un modelo arbitrario. Hay costos y límites registrados por modelo.

### Exportación

`epub-builder.service.ts` (libros) y `pdf-builder.service.ts` (flyers), sobre el mismo
pipeline de jobs: `POST /exports/{books,designs}/:id` y `GET /exports/:jobId/download`.

---

## 7. Supabase

Acá es donde más se confunde la gente, así que va explícito. **Hay tres usos distintos:**

| Uso | Quién | Cómo |
|---|---|---|
| **Auth** | El navegador | `supabase.auth.*` y **nada más**. `services/supabase.ts` exporta solo el cliente |
| **Datos** | El backend | Nest con la **`service_role`**, que **saltea RLS** |
| **Storage** | El backend | Bucket privado de imágenes; URLs firmadas al leer, nunca persistidas |

### RLS: la parte que tenés que entender antes de tocar la base

| Tablas | RLS | Por qué |
|---|---|---|
| `students`, `student_settings`, tablas legacy de opciones | **ON** | Solo backend; `service_role` las saltea |
| `teachers`, `stories`, `usage_sessions` | **OFF** | **Decisión del owner** (SPEC-034 D4) |

El razonamiento de la decisión: el tenant es la fundación, y **toda fundación autenticada
puede ver a todos los docentes**. No hay aislamiento por fila que expresar, así que RLS
queda apagado.

**Lo que tenés que saber igual**, porque no es obvio: con RLS apagado, PostgREST también
atiende al rol `anon`. Es decir, esas tres tablas son alcanzables **sin sesión** usando la
anon key (que es pública por diseño: viaja en el bundle). Está registrado como deuda
declarada en `plan.md` (EPIC 9.6). Si algún día se quiere cerrar, son dos sentencias:
`enable row level security` + una policy `for all to authenticated using (true)`.

### El guard que te va a frenar (y está bien)

`npm run check:supabase` escanea `components/`, `contexts/` y `hooks/` y **falla** si
encuentra:

- un import directo del cliente (`import { supabase } from '.../services/supabase'`), o
- una llamada de datos: `.from(` seguido de comilla, o `.rpc(`.

La allowlist tiene **una sola entrada**: `contexts/AuthContext.tsx`, y solo porque necesita
`supabase.auth.*`. Si tu código legítimamente necesita datos, la respuesta es un endpoint
nuevo en el backend, no una excepción en la allowlist.

### Migraciones

Están en `backend/supabase/migrations/`, se aplican **en orden** y **todas son
re-ejecutables** (idempotentes). `0000_bootstrap.sql` crea las tablas legacy que el resto
asume existentes, para levantar un proyecto nuevo desde cero.

`0015_teacher_identity.sql` es la última: instala un trigger `security definer`
(`handle_new_teacher()`) sobre `auth.users` que crea la fila de `teachers`. **La fila la crea
la base, no el frontend** — así funciona también cuando el alta requiere confirmación por
email.

### Detalle que ahorra una tarde

**Supabase JS no está tipado en este proyecto.** Casteá las respuestas. Además, las rutas de
storage usan el id del job, y las signed URLs **nunca** se persisten: se firman al leer.

---

## 8. Qué falta

### Producto

| ID | Qué | Estado |
|---|---|---|
| SPEC-033C | Budgets por tenant (límites de gasto por fundación) | Pendiente — **es el próximo** |
| SPEC-030 | TTS es-AR (evaluar Google Cloud TTS / ElevenLabs) | Pendiente. Hoy falta es-AR y cae a es-419/es-US |
| SPEC-031 follow-up | Deck PPTX, board PDF, janitor de retención | Pendiente |
| SPEC-031 follow-up | Publicar y vender | Pendiente (lado owner) |
| SPEC-026 | Licencia, changelog, versionado, publicación | **En pausa por decisión del owner** |
| SPEC-027 follow-up | OpenTelemetry y alertas con envío real | Pendiente (hoy solo umbrales documentados) |
| Backlog | Diseñador UX para opciones de libro; nuevas opciones sin saturar | Pendiente |

### Deuda declarada (EPIC 9.6 de `plan.md`)

| Deuda | Nota |
|---|---|
| RLS apagado en `teachers`/`stories`/`usage_sessions` | Decisión consciente del owner, no un olvido |
| `e2e/student-entry.spec.ts:33` es flaky | Afirma un spinner transitorio con el timeout default de 5 s |
| Fallback hardcodeado de URL + anon key en `services/supabase.ts` | La key es pública por diseño, pero convendría dejarla solo por env |

### Acciones de operador (no son código)

- **Aplicar la migración `0015`** en el SQL editor de Supabase. Hasta que se corra, el
  trigger no existe y los docentes nuevos no tienen fila.
- Rotar la key de Gemini expuesta (SPEC-001) y revocar la anterior.
- Crear el bucket `book-images`, definir `AI_SECRETS_MASTER_KEY`, aplicar `0011`+`0012`.

---

## 9. Trampas del entorno local (Windows)

Todas están verificadas y ninguna se arregla sola:

| Síntoma | Causa | Solución |
|---|---|---|
| `npm run test:e2e` no arranca: `Executable doesn't exist ... chrome-headless-shell` | `ms-playwright` está vacío | `npx playwright install chromium` |
| `npm test` del backend falla al instante | Los scripts usan el prefijo POSIX `NODE_OPTIONS=`, que cmd.exe no entiende | `$env:NODE_OPTIONS='--experimental-vm-modules'; npx jest` |
| El e2e del backend da `503 AI_ENDPOINTS_DISABLED` | `ConfigModule.forRoot` hace snapshot en el import, así que tu `backend/.env` local pisa la asignación tardía de `test-app.ts` | Exportá `AI_ENDPOINTS_ENABLED=true` + keys mock + `SUPABASE_URL`/`SERVICE_KEY` **antes** de arrancar Node. En CI no hay `.env` y por eso pasa |
| `Cannot find module .../dom-accessibility-api/dist/index.mjs`, o TS no conoce `toBeInTheDocument` | `node_modules` corrupto por una instalación interrumpida (típico `EPERM` en Windows con archivos bloqueados) | Borrá `node_modules/@testing-library/jest-dom` y corré `npm install`. Si persiste, `npm ci` sin nada abierto |

---

## 10. Checklist del primer día

- [ ] Leí `AGENTS.md`, `MEMORY.md` y `plan.md`.
- [ ] El frontend pasa: `npm run typecheck`, `npm run check:supabase`, `npm test`.
- [ ] El backend pasa: `npm run build` y `npx jest` (con `NODE_OPTIONS` exportado).
- [ ] Entiendo que **la IA nunca va en el frontend** y que `check:supabase` me va a frenar.
- [ ] Entiendo que el backend es dueño de los datos y que Supabase en el frontend es **solo Auth**.
- [ ] Sé que **ningún cambio arranca sin un SPEC aprobado**.
- [ ] Sé que nadie commitea a `dev`: rama → PR → 4 checks verdes → squash.
- [ ] Sé dónde viven las reglas de accesibilidad y que son no negociables.

---

## Próximo paso

Leé el [SPEC-034](../specs/SPEC-034.md) — es el ejemplo más reciente del formato y toca
justo el límite frontend/backend/Supabase que describe la sección 7. Después mirá el
[roadmap](../../plan.md) y elegí un pendiente.
