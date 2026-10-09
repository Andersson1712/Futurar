# Futurar — Plan de ejecución

> Archivo vivo. Se actualiza al cerrar cada tarea.
> Regla: si una tarea cambia una decisión, se registra acá y, si es
> arquitectónica, se crea un ADR en docs/adr/.
> No duplicar MEMORY.md. MEMORY.md = estado compacto. plan.md = roadmap.

Leyenda:
- [ ] pendiente
- [~] en progreso
- [x] completado
- [!] bloqueado
- [-] descartado

---

## Estado actual

- Fase activa: **Fase 9 — Post-MVP (verticales + exportación completos; próximo SPEC-033B)**
- Última tarea cerrada: exportación PDF server-side de flyers (SPEC-031B, PR #51 a dev)
- Próxima tarea: SPEC-033B Selección de modelo por docente (spec a aprobar) — SPEC-030 TTS es-AR y SPEC-026 en pausa per owner
- Rama de integración: `dev` (protegida con CI, 4 checks); `main` congelada y protegida.
- Hito: 4 verticales en `dev` (cuentos, diseños #38, presentaciones #45, tableros #46) + backfill legacy 0013 (#47) + exportación EPUB/PDF (#50/#51) + retiro legacy (#49).

---

## Fase 0 — Contención y seguridad inmediata

### EPIC 0.1 — Neutralizar exposición de IA en frontend
- [ ] SPEC-001: Rotar Gemini API key expuesta y revocar anterior (manual, owner)
- [x] SPEC-001: Auditar bundle del frontend (dist/) por keys, prompts, endpoints
- [x] SPEC-001: Eliminar SDK de Gemini, llamadas directas, prompts y VITE_GEMINI_*
- [x] SPEC-001: Documentar incidente en docs/security/incident-001.md
- [x] Freeze: prohibir PRs que agreguen IA al frontend (CODEOWNERS + AGENTS.md)
- [x] SPEC-001: Endpoints POST /ai/* deshabilitados por defecto (AI_ENDPOINTS_ENABLED)

---

## Fase 1 — Backend Nest como fuente de verdad de la IA

### EPIC 1.1 — Estructura del AiModule
- [x] SPEC-002: Crear AiModule con interfaces Text/Image/Tts
- [x] SPEC-002: GeminiTextAdapter, GeminiImageAdapter, GeminiTtsAdapter
- [x] SPEC-002: ConfigModule con validación de env (class-validator; Zod opcional)
- [x] SPEC-002: Secret handling (env dev; KMS/tenant = SPEC-020)

### EPIC 1.2 — Contratos y DTOs
- [x] SPEC-003: DTOs GenerateBookRequest / Response / JobStatus / AiError
- [x] SPEC-003: Validación con class-validator
- [x] SPEC-003: OpenAPI/Swagger en /api/v1
- [x] SPEC-003: Idempotency-Key en POST /ai/books/generate

### EPIC 1.3 — Prompts y mapeo de opciones
- [x] SPEC-004: Mover plantillas y mapeo opción→prompt al backend
- [x] SPEC-004: Versionar prompts (prompts/book/v1/…)
- [x] SPEC-004: PromptBuilder + tests unitarios
- [x] SPEC-004: Soporte de dedicatoria en prompt
- [x] SPEC-004: Soporte de audiencia (niño/adolescente/adulto)

### EPIC 1.4 — Validación de salida IA
- [x] SPEC-005: JSON Schema del libro
- [x] SPEC-005: Validación server-side antes de persistir
- [x] SPEC-005: Moderación por audiencia
- [x] SPEC-005: Límites (capítulos, tokens, páginas)

---

## Fase 2 — Jobs, SSE y persistencia

### EPIC 2.1 — Cola de generación
- [x] SPEC-006: BullMQ + Redis para book-generation
- [x] SPEC-006: GenerationJob en Supabase (id, userId, profileId, status, …)
- [x] SPEC-006: Retries con backoff + circuit breaker
- [x] SPEC-006: Idempotencia por Idempotency-Key

### EPIC 2.2 — Streaming al frontend
- [x] SPEC-007: GET /ai/jobs/:id/events (SSE)
- [x] SPEC-007: Auth en SSE
- [x] SPEC-007: Fallback polling

### EPIC 2.3 — Persistencia del libro
- [x] SPEC-008: Guardar libro validado + URLs de imágenes
- [x] SPEC-008: Signed URLs con expiración
- [x] SPEC-008: Auditoría (quién, cuándo, prompt version, costo)
- [x] SPEC-008: Soft delete y versionado

---

## Fase 3 — Migración del frontend

### EPIC 3.1 — Frontend consume solo backend
- [x] SPEC-009: Reemplazar llamadas Gemini por llamadas a Nest
- [x] SPEC-001: Eliminar @google/generative-ai del package.json
- [x] SPEC-001: Eliminar VITE_GEMINI_* del frontend
- [x] SPEC-009: Adaptar estados de carga al SSE
- [x] SPEC-009: Manejo de errores con códigos + i18n

### EPIC 3.2 — Supabase solo Auth en frontend
- [x] SPEC-010: Auditar que frontend no use Supabase para datos
- [x] SPEC-010: JWT en cada request al backend
- [x] SPEC-010: Refresh de sesión
- [x] SPEC-010: Logout limpia estado local

---

## Fase 4 — Accesibilidad: bugs críticos

### EPIC 4.1 — Clic gana al foco del barrido
- [x] SPEC-011: Fix pointerdown con data-option
- [x] SPEC-011: Cancelar timer del barrido al interactuar
- [x] SPEC-011: Test: foco en A, click en B → selecciona B
- [x] SPEC-015: Modos por perfil (movido desde SPEC-011)

### EPIC 4.2 — Scroll bloqueado
- [x] SPEC-012: Quitar overflow:hidden global
- [x] SPEC-012: min-height:100dvh + touch-action:pan-y + passive listeners
- [x] SPEC-012: Test E2E scroll mobile/desktop

### EPIC 4.3 — Focus trap del menú "Más"
- [x] SPEC-013: Focus trap Continuar/Pausar/Volver
- [x] SPEC-013: Test: no se puede salir sin seleccionar

### EPIC 4.4 — Autoguardado y continuar
- [x] SPEC-014: Persistir progreso del wizard y visor
- [x] SPEC-014: Test: abandonar y volver → continúa

### EPIC 4.5 — Configuración de accesibilidad por perfil
- [x] SPEC-015: Velocidad de barrido persistida por perfil
- [x] SPEC-015: Barrido on/off por perfil
- [x] SPEC-015: Tamaño de letra 16/19/22 en pantalla y textos (decisión D3)
- [x] SPEC-015: Interlineado configurable
- [x] SPEC-015: Negrita en títulos
- [x] SPEC-015: Mayúsculas en toda la plataforma
- [x] SPEC-015: Voz masculina/femenina + fallback es-US documentado
- [x] SPEC-015: prefers-reduced-motion / contrast

### EPIC 4.6 — Estándares
- [x] SPEC-016: Auditoría WCAG 2.2 AA
- [x] SPEC-016: Alineación ISO/IEC 17549-3
- [x] SPEC-016: EN 301 549 si aplica
- [x] SPEC-016: Declaración de accesibilidad publicada (repo; web en SPEC-025)

---

## Fase 5 — Frontend: test runner y calidad

### EPIC 5.1 — Infraestructura de tests
- [x] SPEC-017: Vitest + RTL + user-event + axe-core (vitest-axe directo)
- [x] SPEC-017: Scripts test / test:watch / test:coverage
- [x] SPEC-017: MSW para mock de API
- [x] SPEC-017: Playwright para E2E

### EPIC 5.2 — Tests críticos
- [x] SPEC-018: Test click wins over focus (SPEC-011)
- [x] SPEC-018: Test focus trap del menú Más (SPEC-013)
- [x] SPEC-018: Test autosave + continuar (SPEC-014)
- [x] SPEC-018: Test scroll mobile/desktop (SPEC-012)
- [x] SPEC-018: Test TTS activo por defecto
- [x] SPEC-018: Test i18n sin strings críticos hardcodeados (capa completa pendiente)
- [x] SPEC-018: Test a11y con axe (SPEC-016)
- [x] SPEC-018: E2E flujo crítico wizard→generación→lector

### EPIC 5.3 — CI frontend
- [x] SPEC-019: GitHub Actions lint/typecheck/test/build
- [x] SPEC-019: Bloquear merge si falla
- [x] SPEC-019: Coverage no decreciente

---

## Fase 6 — Panel de administración

### EPIC 6.1 — Configuración de API key
- [x] SPEC-020: UI admin para ingresar key
- [x] SPEC-020: Backend cifra con AES-256-GCM (master key; KMS adapter futuro)
- [x] SPEC-020: Nunca devuelve key completa
- [x] SPEC-020: Rotación sin downtime
- [x] SPEC-020: Multi-fundación (key por tenant; `tenant_id` reservado)

### EPIC 6.2 — Gestión de perfiles
- [x] SPEC-021: CRUD perfiles (nombre, fecha nac, avatar; soft delete)
- [x] SPEC-021: Módulos activos por perfil (`modules jsonb`)
- [x] SPEC-021: Config técnica (velocidad, voz, barrido on/off) vía backend
- [x] SPEC-021: Complejidad del libro (tamaño, audiencia) usada al generar

### EPIC 6.3 — Dedicaciones
- [x] SPEC-022: Contactos por perfil (tabla `profile_contacts`, CRUD docente)
- [x] SPEC-022: Asignación perfil ↔ contactos (1:N con cascada)
- [x] SPEC-022: UI de dedicatoria en visor (+ favoritos de libros backend)

### EPIC 6.4 — Acciones y opciones dinámicas (norte)
- [x] SPEC-023: Modelo Acción → Opciones → Ítems (nivel/tipo) por docente
- [x] SPEC-023: CRUD de acciones y opciones (backend; editor docente migrado)
- [x] SPEC-023: Permisos por perfil (`profile_actions`/`profile_option_items`)
- [x] SPEC-023B: Límites por pantalla/acción/página (max_enabled, paginación) — merge #29
- [x] SPEC-023C: Catálogo introductorio global para docentes nuevos — merge #40
- [x] Intro seed aplicado vía service key (79 ítems, 2026-10-03); migraciones 0000→0009 verificadas aplicadas (futurar-migrations-all.sql + 0009) — pendiente descartado

---

## Fase 7 — Proceso, gobernanza y open source

### EPIC 7.1 — Git flow
- [x] SPEC-024: Proteger main (PR, review, CI, linear, no force push) — merge #33
- [x] SPEC-024: commitlint + husky — merge #35
- [x] SPEC-024: PR template con checklist a11y y tests — merge #33
- [x] SPEC-024: Issue templates — merge #33
- [x] SPEC-024: CODEOWNERS — merge #33
- [x] SPEC-024: Squash merge por defecto — merge #33

### EPIC 7.2 — Documentación
- [x] SPEC-025: README.md (en) + README.es.md (es)
- [x] SPEC-025: CONTRIBUTING, SECURITY, CODE_OF_CONDUCT
- [x] SPEC-025: ADRs en docs/adr/
- [x] SPEC-025: Guías de usuario en español
- [x] SPEC-025: Guía de arquitectura
- [x] SPEC-025: Guía de accesibilidad
- [x] SPEC-025: Guía de i18n

### EPIC 7.3 — Licencia y release
- [ ] SPEC-026: LICENSE (definir) — en pausa per owner
- [ ] SPEC-026: CHANGELOG con semantic-release o changesets — en pausa per owner
- [ ] SPEC-026: Versionado semántico — en pausa per owner
- [ ] SPEC-026: Publicación en GitHub público — en pausa per owner

---

## Fase 8 — Observabilidad y operación

### EPIC 8.1 — Logs, métricas, trazas
- [x] SPEC-027: Correlation ID por request — merge #34
- [x] SPEC-027: Logs estructurados (pino) — merge #34
- [x] SPEC-027: Métricas (latencia, tokens, costo, errores) — merge #34
- [ ] SPEC-027: OpenTelemetry (follow-up, no inventado en baseline)
- [ ] SPEC-027: Alertas de fallos y costos anómalos (solo umbrales en `docs/ops/alerts.md`)

### EPIC 8.2 — Testing backend
- [x] SPEC-028: Integration generate→job→SSE→book con proveedor mockeado — merge #37
- [x] SPEC-028: Failure paths (INVALID_OUTPUT, CONTENT_BLOCKED) + Idempotency-Key replay — merge #37
- [x] SPEC-028: E2E observabilidad (correlation echo, health pública, metrics 401) — merge #37

---

## Fase 9 — Post-MVP / norte

### EPIC 9.1 — Nuevos verticales
- [x] SPEC-029: Diseños (flyers) — framework de verticales + primer vertical (merge #38)
- [x] SPEC-029B: Presentaciones (merge #45)
- [x] SPEC-029C: Comunicación, tableros con vista de uso que habla (merge #46)
- [x] SPEC-032: Backfill `stories`→`books` (migración 0013) + retiro de lecturas/escrituras legacy del frontend (merge #47 + #49; tabla `stories` queda como respaldo)

### EPIC 9.2 — TTS es-AR
- [ ] SPEC-030: Evaluar Google Cloud TTS / ElevenLabs
- [ ] SPEC-030: Migrar manteniendo fallback local

### EPIC 9.3 — Exportación y venta
- [x] SPEC-031: Exportación server-side EPUB (libros) — merge #50
- [x] SPEC-031B: Exportación server-side PDF (flyers de diseños) — merge #51
- [ ] SPEC-031 follow-up: otros formatos/verticales (deck PPTX, board PDF) + janitor de retención
- [ ] SPEC-031 follow-up: Publicar y vender (owner-side)

### EPIC 9.4 — Crecimiento del sistema
- [ ] Backlog (ex SPEC-032, número reasignado al backfill legacy): Diseñador UX para opciones de libro
- [ ] Backlog (ex SPEC-032): Nuevas opciones sin saturar

### EPIC 9.5 — Multi-modelo (OpenRouter)
- [x] SPEC-033: OpenRouter como segundo proveedor (allowlist curada texto/imagen, migración 0010, costo) — merge #41
- [~] SPEC-033B: Selección de modelo por docente (aprobada 2026-10-09; en curso)
- [ ] SPEC-033C: Budgets por tenant (follow-up, solo registro en 033)
- [ ] SPEC-033D: Resolución de credenciales por tenant y por proveedor (split de 033B; aprobada 2026-10-09)

---

## Reglas de secuencia

- No se empieza Fase 3 sin Fase 1 y 2 aprobadas.
- No se mergea nada sin Fase 5.1 y Fase 7.1 listos.
- Fase 4 puede ir en paralelo con Fase 1-2 si hay capacidad.
- Cada EPIC requiere SPEC aprobado antes de tocar código.

## Registro de SPECs

| SPEC | Título | Estado | Aprobado por | Fecha |
|------|--------|--------|--------------|-------|
| SPEC-001 | Rotar key y eliminar IA del frontend | implementado (rotación manual pendiente) | owner | 2026-09-30 |
| SPEC-002 | AiModule Nest 12 + adapters Gemini + env/secrets | implementado | owner | 2026-09-30 |
| SPEC-003 | Contratos HTTP IA: DTOs, OpenAPI /api/v1, idempotencia, auth | implementado | owner | 2026-09-30 |
| SPEC-004 | Prompts versionados book/v1 + PromptBuilder | implementado | owner | 2026-09-30 |
| SPEC-005 | Validación de salida, moderación, límites y job in-memory | implementado | owner | 2026-09-30 |
| SPEC-006 | BullMQ/Redis + jobs Supabase + retries + breaker | implementado | owner | 2026-09-30 |
| SPEC-007 | SSE de estado de job + fallback polling | implementado | owner | 2026-09-30 |
| SPEC-008 | Persistencia de libros, imágenes, auditoría y soft delete | implementado | owner | 2026-09-30 |
| SPEC-009 | Frontend genera vía backend (SSE + polling + biblioteca) | implementado | owner | 2026-09-30 |
| SPEC-010 | Sesión (JWT/refresh/logout) y auditoría de acceso a datos | implementado | owner | 2026-09-30 |
| SPEC-011 | Clic/pointerdown gana al foco del barrido + runner de tests | implementado | owner | 2026-09-30 |
| SPEC-012 | Scroll libre mobile/desktop + E2E Playwright | implementado | owner | 2026-09-30 |
| SPEC-013 | Focus trap del menú de controles + navegación por switch | implementado | owner | 2026-09-30 |
| SPEC-014 | Autoguardado y continuar (wizard + visor) | implementado | owner | 2026-09-30 |
| SPEC-015 | Accesibilidad por perfil (barrido/modos/texto/voz) | implementado | owner | 2026-09-30 |
| SPEC-016 | Auditoría WCAG 2.2 AA, ISO 17549-3 y declaración | implementado | owner | 2026-09-30 |
| SPEC-017 | Infra de tests: MSW + cobertura + E2E | implementado | owner | 2026-09-30 |
| SPEC-018 | Tests críticos, i18n guard y E2E de flujo | implementado | owner | 2026-09-30 |
| SPEC-019 | CI GitHub Actions + protección de rama dev | implementado | owner | 2026-09-30 |
| SPEC-020 | Claves de IA cifradas por docente + rotación | implementado | owner | 2026-09-30 |
| SPEC-021 | Perfiles backend + migración frontend | implementado | owner | 2026-10-03 |
| SPEC-022 | Contactos, dedicatorias y favoritos | implementado | owner | 2026-10-03 |
| SPEC-023 | Catálogo acciones/opciones + permisos | implementado | owner | 2026-10-03 |
| SPEC-023B | Límites por pantalla + paginación wizard | implementado (#29) | owner | 2026-10-03 |
| SPEC-024 | Git flow, commitlint, templates, CODEOWNERS | implementado (#33/#35) | owner | 2026-10-03 |
| SPEC-025 | Documentación pública + ADRs + guías | implementado (#31) | owner | 2026-10-03 |
| SPEC-026 | Licencia, versionado y publicación | en pausa per owner | — | — |
| SPEC-027 | Observabilidad backend (correlation, pino, métricas, health) | implementado (#34) | owner | 2026-10-03 |
| SPEC-028 | Integración + E2E backend con proveedor mockeado | implementado (#37) | owner | 2026-10-03 |
| SPEC-029 | Verticales: framework + Diseños (flyers) | implementado (#38) | owner | 2026-10-03 |
| SPEC-029B | Presentaciones (decks 5/8/10) | implementado (#45) | owner | 2026-10-07 |
| SPEC-029C | Comunicación (tableros + vista de uso) | implementado (#46) | owner | 2026-10-08 |
| SPEC-032 | Backfill `stories`→`books` (0013) + retiro legacy frontend | implementado (#47/#49) | owner | 2026-10-08 |
| SPEC-031 | Exportación server-side: EPUB de libros | implementado (#50) | owner | 2026-10-08 |
| SPEC-031B | Exportación server-side: PDF de flyers (diseños) | implementado (#51) | owner | 2026-10-08 |
| SPEC-033 | OpenRouter multi-modelo (allowlist curada) | implementado (#41) | owner | 2026-10-03 |
| SPEC-033B | Selección de modelo por docente (catálogo curado) | aprobada | owner | 2026-10-09 |
| SPEC-033D | Credenciales por tenant y por proveedor | aprobada | owner | 2026-10-09 |

## Notas

- Reconciliación 2026-10-09: `plan.md` y `MEMORY.md` alineados con `dev`. Cerrados
  SPEC-015 (modos por perfil; ya estaba en código con `input_mode`), SPEC-031 (EPUB,
  #50) y SPEC-031B (PDF flyers, #51); SPEC-033 core ya estaba en #41 (su spec
  pendiente de marcar como implementado). Próximo trabajo real: SPEC-033B.
- Mantener este archivo enfocado en roadmap. No duplicar MEMORY.md.
- Al cerrar una tarea: marcar [x], actualizar "Estado actual", registrar SPEC.
- Si una tarea se descarta: marcar [-] y anotar motivo en Notas.
- Si aparece un bloqueo: marcar [!] y describir en "Estado actual".
- SPEC-001 hallazgo: `.env` estaba trackeado en git; ya está ignorado y destrackeado
  (sin keys Gemini reales en el historial). Deuda preexistente: backend `npm run lint`
  en rojo por formato Prettier (código a 4 espacios); resuelta junto a SPEC-002.
- SPEC-001: `npm run build` OK; grep de keys/prompts en `dist/` = 0; test del guard pasa.
- SPEC-002: upgrade Nest 11→12 + TS 6 (paquetes ESM; app CJS vía require(esm),
  Node ≥ 20.19), `@google/genai` 2.x, eliminados `openai`, `@anthropic-ai/sdk`,
  `groq-sdk` y los providers/DTOs que aceptaban `apiKey` del cliente.
  Jest requiere `NODE_OPTIONS=--experimental-vm-modules` (scripts actualizados).
  Frontend: React 19.2.4→19.3 + `@types/react(-dom)` (faltaban).
  Métricas: backend build OK, 26 unit + 1 e2e verdes, `npm run lint` en verde,
  `prettier --check` limpio; boot falla si `AI_ENDPOINTS_ENABLED=true` sin
  `GEMINI_API_KEY`.
  Pendiente como chore aparte: Vite 6→8 + TS frontend 5.8→6/7; evaluar Zod para
  env cuando se apruebe la dependencia.
- SPEC-003: contratos HTTP en `/api/v1` con class-validator, envelope `AiError`
  (filtro global), `Idempotency-Key` (store in-memory TTL 24h + interceptor),
  auth Supabase (`auth.getUser`) y throttler (`@nestjs/throttler`).
  Endpoint POST `/ai/books/generate` devuelve 202 con el contrato y hoy responde
  501 `NOT_IMPLEMENTED` (pipeline real = SPEC-004/005/006); `AI_ENDPOINTS_ENABLED`
  sigue en false por defecto y el boot exige Supabase + Gemini si se habilita.
  Swagger en `/api/v1/docs` (off en producción); `setupSwagger` debe correr
  antes de `app.listen` (Express 5 no sirve rutas registradas después).
  Métricas: 60 unit + 1 e2e verdes, lint y prettier limpios, OpenAPI verificado.
- SPEC-004/005: prompts versionados `book/v1` (5/10/15 páginas, audiencia,
  dedicatoria, JSON schema para structured output) + parser tolerante,
  validador class-validator, moderación whole-word por audiencia y límites
  (`BOOK_LIMITS`). `BookGenerationService` genera de forma síncrona con
  registry in-memory (TTL 24h) cuando `AI_ENDPOINTS_ENABLED=true`; SPEC-006 lo
  reemplaza por BullMQ/Redis sin cambiar contratos. Códigos nuevos:
  `INVALID_OUTPUT` (502) y `CONTENT_BLOCKED` (422). Métricas: 91 unit + 1 e2e
  verdes, lint/prettier limpios.
- SPEC-006/007: pipeline durable con `QUEUE_DRIVER=inline|bullmq` (default
  bullmq solo con `REDIS_URL`), `JobRepository` (Supabase + migración
  `0001_generation_jobs.sql` y fallback in-memory), retries 3× backoff
  exponencial, circuit breaker (5 fallos/60s), idempotencia Redis o in-memory.
  SSE en `/api/v1/ai/jobs/:id/events` con polling server-side 1s, heartbeat 15s
  y cierre en estado terminal; auth header-only. Se usó `bullmq` directo en vez
  de `@nestjs/bullmq` para mantener el driver condicional (una dep menos).
  Métricas: 130 unit + 1 e2e verdes, lint/prettier limpios; smoke verifica SSE
  registrado en OpenAPI y 401 sin token.
- SPEC-008: tablas `books` + `book_versions` (migración `0002_books.sql`) con
  `save` idempotente por `generation_job_id`, auditoría por versión, soft
  delete y `/api/v1/books` (list/get/delete). Imágenes por página best-effort
  tras `BOOK_IMAGES_ENABLED` (default false), bucket privado `book-images` y
  signed URLs con TTL configurable (nunca se persisten URLs). `stories` del
  frontend queda intacta para SPEC-010. Acciones manuales del owner: aplicar
  0001/0002, crear bucket y rotar la key. Métricas: 163 unit + 1 e2e verdes,
  lint/prettier limpios; smoke verifica 401 y paths en OpenAPI.
- SPEC-009/010: frontend con cliente API propio (`services/backendApi.ts`,
  `bookGeneration.ts` con SSE por fetch + polling y `backendBooks.ts`), generación
  real con errores es-AR por código, biblioteca que mezcla libros del backend
  (`GET /books?profileId=`) con `stories` legacy en solo-lectura y sin escrituras
  duplicadas. Backend: `profileId` opcional en el request, `story_config` en las
  versiones y filtro de listado. Sesión: JWT fresco con refresh+retry en 401,
  logout limpia estado y check `npm run check:supabase` con allowlist.
  Scripts nuevos: `typecheck` y `check:supabase`. Métricas: frontend
  typecheck/build/check verdes; backend 165 unit + 1 e2e, lint/prettier limpios.
  Deuda registrada: students/options siguen en Supabase (SPEC-021/023) y
  analytics en SPEC-027.
- SPEC-011: opciones con `data-option` y selección en `pointerdown` (guarda de
  disparo único + cancelación del timer del barrido); `useInputDevice` pasó de
  `click` a `pointerdown` ignorando botones/inputs/opciones. Runner mínimo de
  SPEC-017 adelantado: Vitest 5 + RTL + jsdom con `npm test` (7 tests de
  regresión). Modos por perfil movidos a SPEC-015. `dev` es la rama de
  integración (SPEC-001→011) y `main` se actualiza al cerrar fase; el dev
  legacy quedó respaldado en `dev-legacy-backup`.
- SPEC-012: scroll desbloqueado (`overflow-x` only + `touch-action: pan-y` +
  `min-h-[100dvh]` + helper `safe-center`), mains con `overflow-y-auto` y
  pantallas de editor/reader/teacher con dvh. E2E con Playwright 1.63
  (Chromium 1243 ya cacheado): 5 tests × desktop/Pixel 7 = 9 passed / 1 skip;
  scripts `test:e2e`; `e2e/` excluido de Vitest.
- SPEC-013: `FloatingControls` es un diálogo modal con backdrop (afuera no
  cierra), foco atrapado y navegación por barrido (auto-avance + Space/Enter/HID,
  flechas, Tab cicla), salidas explícitas `Cerrar`/Escape; guard en fase de
  captura + `isModalOpen` en `ScanSettingsContext` pausan el grid de atrás.
  7 tests nuevos (14 en total) cubren trap, afuera, Tab, Space, Escape, pausa y
  Menú Principal. `npm run test:e2e` completo verde (9 passed / 1 skip).
- SPEC-014: `utils/progressStore.ts` (clave versionada por alumno, pasos
  whitelisteados, `GENERATING → SELECT_STYLE`, config vacía válida, viewer
  descartado si no hay cuota) + restauración/guardado en `StudentApp`
  (debounce 300 ms + `pagehide`) y scroll del visor en `StoryReader`. Se limpia
  en cambio de perfil, cuento nuevo y logout. 23 tests frontend en total.
- SPEC-015: migración `0003` agrega sweep/input_mode/line_height/bold/uppercase/
  voice_gender a `student_settings`; `utils/accessibility.ts` + `useAccessibility`
  aplican fuente 16/19/22, interlineado, mayúsculas y negrita en `<html>`;
  `ScanSettingsContext` se siembra del perfil (la velocidad del control flotante
  ahora sí llega a los grids); `ScanningGrid` solo auto-avanza con sweep en
  scan/switch; voz es-AR→es-419→es-US con género; reduced-motion/contrast por
  CSS. Editor docente con los nuevos controles. 38 tests frontend.
- SPEC-016: axe-core en Vitest (0 violaciones en 6 pantallas), contraste
  verificado por ratios (`primary` oscurecido a `#0b6bd3`), `:focus-visible`
  global, gray-500→gray-400, targets ≥44px y hook `useDialogA11y` en los
  modales restantes. Declaración es-AR + auditoría + alineación ISO 17549-3 y
  aplicabilidad EN 301 549 en `docs/accessibility/`. 54 tests frontend.
  Fase 4 cerrada.
- SPEC-017: MSW 2.15 (v3 pide TS ≥5.9) con handlers de la API Nest; tests de
  `backendApi`/`bookGeneration` (SSE, fallback, abort, errores) y
  `backendBooks`; `test:coverage` con umbral no decreciente
  (35/34/32/36 sobre 36.7/36.1/33.8/38.1 medido). Bug de abort ya-señalado
  corregido en `followJob`/`delay`. 66 tests frontend.
- SPEC-018: tests de TTS por defecto, diccionario i18n tipado (`t()` lanza en
  claves desconocidas) con textos críticos migrados (controles, scan, wizard,
  login, biblioteca, lector) y E2E de flujo completo con interceptación de
  Supabase REST + API Nest (11 E2E passed / 1 skip). Umbral de cobertura subido
  a 36/35/33/37 (medido 37.6/37.5/34.6/39). 72 tests frontend.
- SPEC-019: workflow `.github/workflows/ci.yml` con jobs `frontend`
  (typecheck/check/coverage/build), `frontend-e2e` (Playwright) y `backend`
  (build/lint/test/e2e) en Node 24; protección de `dev` con los 3 checks
  requeridos, sin force-push ni borrado y PR obligatorio (0 aprobaciones,
  admin puede excepcionar). ESLint frontend queda como chore aparte.
  Fase 5 cerrada.
- SPEC-020: `ai_credentials` (migración 0004) con AES-256-GCM y master key
  `AI_SECRETS_MASTER_KEY`; `SecretProvider` async y por tenant con fallback a
  env; `GeminiClientProvider` cachea por hash de key (rotación sin restart);
  API `/api/v1/ai/credentials` solo metadata; flag `AI_CREDENTIALS_ENABLED`
  default false; panel `ApiKeyPanel` en el panel docente. 190 tests backend +
  78 frontend; cobertura 38.7/38.1/36.1/40.2.
- SPEC-021: `ProfilesModule` (migración 0005: `birthdate`, `modules`,
  `book_story_size`, `book_audience`) con CRUD scoped por docente, soft delete,
  `PUT /settings` validado y `GET /options` de solo lectura; el provider de
  settings del perfil alimenta `generation-runner` (storySize/audience del
  perfil, fallback medium/child). Frontend migra `StudentApp`/`TeacherPanel`/`SettingsPanel`/
  `StudentEditor` a `services/backendProfiles.ts` (mappers camel↔snake),
  `TeacherPanel` exige login, `StudentContext` eliminado y allowlist de
  `check:supabase` reducida (queda StudentEditor/TeacherPanel para options y
  `stories`/`usage_sessions` legacy). 204 tests backend + 88 frontend; E2E con
  mock Nest de perfiles. Owner: aplicar 0005.
- SPEC-022: migración 0006 con `profile_contacts` (cascada por perfil) y
  dedicatoria/favorito a nivel libro (`dedication_to/reason/position`,
  `is_favorite`); `ContactsModule` dentro de `ProfilesModule` (CRUD scoped por
  docente) y `PUT/DELETE /books/:id/dedication` + `PUT /books/:id/favorite`;
  la generación persiste la dedicatoria pedida. Frontend:
  `services/backendContacts.ts`, modal de dedicatoria en el visor (contactos +
  texto libre + posición + quitar), favorito en visor y filtro en biblioteca,
  PDF prellenado, pestaña Contactos en el editor y limpieza del código muerto
  de `stories`. 222 tests backend + 101 frontend; cobertura 47.8/46.5/44.7/50.1.
  Owner: aplicar 0006.
- SPEC-023: migración 0007 con catálogo `actions`/`action_options`/
  `action_option_items` + permisos `profile_actions`/`profile_option_items`;
  seed por docente y backfill deduplicado idempotente desde las tablas legacy
  (read-only). `ActionsModule` con CRUD docente; `ProfilesService` usa el
  catálogo para el adapter de `GET /profiles/:id/options`, siembra defaults al
  crear perfil, espeja `modules` y expone `GET/PUT /profiles/:id/actions|items`.
  Frontend: `services/backendActions.ts`, pestaña Elementos del editor sobre el
  catálogo, `TeacherPanel` sin seed local y allowlist de `check:supabase`
  reducida a `StoryDetails`/`StoryReader`/`StudentLibrary`/`AuthContext`.
  234 tests backend + 106 frontend; cobertura 50.5/49.4/49.5/53.0. Límites y
  paginación quedan para SPEC-023B. Owner: aplicar 0007.