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

- Fase activa: **Fase 2 — Jobs, SSE y persistencia**
- Última tarea cerrada: SPEC-007 (implementado; SSE y cola BullMQ/inline verdes)
- Próxima tarea: SPEC-008 (persistencia del libro, auditoría y signed URLs)
- Bloqueos: ninguno. SPEC-001 rotación/purga de key sigue pendiente del owner
  (bloquea pruebas con Gemini real, no el desarrollo).

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
- [ ] SPEC-008: Guardar libro validado + URLs de imágenes
- [ ] SPEC-008: Signed URLs con expiración
- [ ] SPEC-008: Auditoría (quién, cuándo, prompt version, costo)
- [ ] SPEC-008: Soft delete y versionado

---

## Fase 3 — Migración del frontend

### EPIC 3.1 — Frontend consume solo backend
- [ ] SPEC-009: Reemplazar llamadas Gemini por llamadas a Nest
- [ ] SPEC-009: Eliminar @google/generative-ai del package.json
- [ ] SPEC-009: Eliminar VITE_GEMINI_* del frontend
- [ ] SPEC-009: Adaptar estados de carga al SSE
- [ ] SPEC-009: Manejo de errores con códigos + i18n

### EPIC 3.2 — Supabase solo Auth en frontend
- [ ] SPEC-010: Auditar que frontend no use Supabase para datos
- [ ] SPEC-010: JWT en cada request al backend
- [ ] SPEC-010: Refresh de sesión
- [ ] SPEC-010: Logout limpia estado local

---

## Fase 4 — Accesibilidad: bugs críticos

### EPIC 4.1 — Clic gana al foco del barrido
- [ ] SPEC-011: Fix pointerdown con closest('[data-option]')
- [ ] SPEC-011: Cancelar timer del barrido al interactuar
- [ ] SPEC-011: Test: foco en A, click en B → selecciona B
- [ ] SPEC-011: Modos por perfil (barrido/mouse/pulsador/táctil)

### EPIC 4.2 — Scroll bloqueado
- [ ] SPEC-012: Quitar overflow:hidden global
- [ ] SPEC-012: min-height:100dvh + touch-action:pan-y + passive listeners
- [ ] SPEC-012: Test E2E scroll mobile/desktop

### EPIC 4.3 — Focus trap del menú "Más"
- [ ] SPEC-013: Focus trap Continuar/Pausar/Volver
- [ ] SPEC-013: Test: no se puede salir sin seleccionar

### EPIC 4.4 — Autoguardado y continuar
- [ ] SPEC-014: Persistir progreso del wizard y visor
- [ ] SPEC-014: Test: abandonar y volver → continúa

### EPIC 4.5 — Configuración de accesibilidad por perfil
- [ ] SPEC-015: Velocidad de barrido persistida por perfil
- [ ] SPEC-015: Barrido on/off por perfil
- [ ] SPEC-015: Tamaño de letra 12/16/22 en pantalla y textos
- [ ] SPEC-015: Interlineado configurable
- [ ] SPEC-015: Negrita en títulos
- [ ] SPEC-015: Mayúsculas en toda la plataforma
- [ ] SPEC-015: Voz masculina/femenina + fallback es-US documentado
- [ ] SPEC-015: prefers-reduced-motion / contrast

### EPIC 4.6 — Estándares
- [ ] SPEC-016: Auditoría WCAG 2.2 AA
- [ ] SPEC-016: Alineación ISO/IEC 17549-3
- [ ] SPEC-016: EN 301 549 si aplica
- [ ] SPEC-016: Declaración de accesibilidad publicada

---

## Fase 5 — Frontend: test runner y calidad

### EPIC 5.1 — Infraestructura de tests
- [ ] SPEC-017: Vitest + RTL + user-event + vitest-axe
- [ ] SPEC-017: Scripts test / test:watch / test:coverage
- [ ] SPEC-017: MSW para mock de API
- [ ] SPEC-017: Playwright para E2E

### EPIC 5.2 — Tests críticos
- [ ] SPEC-018: Test click wins over focus
- [ ] SPEC-018: Test focus trap del menú Más
- [ ] SPEC-018: Test autosave + continuar
- [ ] SPEC-018: Test scroll mobile/desktop
- [ ] SPEC-018: Test TTS activo por defecto
- [ ] SPEC-018: Test i18n sin strings hardcodeados
- [ ] SPEC-018: Test a11y con vitest-axe

### EPIC 5.3 — CI frontend
- [ ] SPEC-019: GitHub Actions lint/typecheck/test/build
- [ ] SPEC-019: Bloquear merge si falla
- [ ] SPEC-019: Coverage no decreciente

---

## Fase 6 — Panel de administración

### EPIC 6.1 — Configuración de API key
- [ ] SPEC-020: UI admin para ingresar key
- [ ] SPEC-020: Backend cifra con KMS/libsodium
- [ ] SPEC-020: Nunca devuelve key completa
- [ ] SPEC-020: Rotación sin downtime
- [ ] SPEC-020: Multi-fundación (key por tenant)

### EPIC 6.2 — Gestión de perfiles
- [ ] SPEC-021: CRUD perfiles (nombre, apellido, fecha nac, avatar)
- [ ] SPEC-021: Módulos activos por perfil
- [ ] SPEC-021: Config técnica (velocidad, voz, barrido on/off)
- [ ] SPEC-021: Complejidad del libro (capítulos, tamaño, audiencia)

### EPIC 6.3 — Dedicaciones
- [ ] SPEC-022: Contactos por perfil
- [ ] SPEC-022: Asignación perfil ↔ contactos
- [ ] SPEC-022: UI de dedicatoria en visor

### EPIC 6.4 — Acciones y opciones dinámicas (norte)
- [ ] SPEC-023: Modelo Acción → Opciones → Niveles → Tipos
- [ ] SPEC-023: CRUD de acciones y opciones
- [ ] SPEC-023: Permisos por perfil
- [ ] SPEC-023: Límites por pantalla/acción/página

---

## Fase 7 — Proceso, gobernanza y open source

### EPIC 7.1 — Git flow
- [ ] SPEC-024: Proteger main (PR, review, CI, linear, no force push)
- [ ] SPEC-024: commitlint + husky
- [ ] SPEC-024: PR template con checklist a11y y tests
- [ ] SPEC-024: Issue templates
- [ ] SPEC-024: CODEOWNERS
- [ ] SPEC-024: Squash merge por defecto

### EPIC 7.2 — Documentación
- [ ] SPEC-025: README.md (en) + README.es.md (es)
- [ ] SPEC-025: CONTRIBUTING, SECURITY, CODE_OF_CONDUCT
- [ ] SPEC-025: ADRs en docs/adr/
- [ ] SPEC-025: Guías de usuario en español
- [ ] SPEC-025: Guía de arquitectura
- [ ] SPEC-025: Guía de accesibilidad
- [ ] SPEC-025: Guía de i18n

### EPIC 7.3 — Licencia y release
- [ ] SPEC-026: LICENSE (definir)
- [ ] SPEC-026: CHANGELOG con semantic-release o changesets
- [ ] SPEC-026: Versionado semántico
- [ ] SPEC-026: Publicación en GitHub público

---

## Fase 8 — Observabilidad y operación

### EPIC 8.1 — Logs, métricas, trazas
- [ ] SPEC-027: Correlation ID por request
- [ ] SPEC-027: Logs estructurados (pino)
- [ ] SPEC-027: Métricas (latencia, tokens, costo, errores)
- [ ] SPEC-027: OpenTelemetry
- [ ] SPEC-027: Alertas de fallos y costos anómalos

### EPIC 8.2 — Testing backend
- [ ] SPEC-028: Unit PromptBuilder, validación, adaptadores
- [ ] SPEC-028: Integración con proveedor mockeado
- [ ] SPEC-028: E2E flujo completo con Supabase test

---

## Fase 9 — Post-MVP / norte

### EPIC 9.1 — Nuevos verticales
- [ ] SPEC-029: Diseños (flyers)
- [ ] SPEC-029: Presentaciones
- [ ] SPEC-029: Comunicación (cómo me siento, pedir ayuda, etc.)

### EPIC 9.2 — TTS es-AR
- [ ] SPEC-030: Evaluar Google Cloud TTS / ElevenLabs
- [ ] SPEC-030: Migrar manteniendo fallback local

### EPIC 9.3 — Exportación y venta
- [ ] SPEC-031: Exportar PDF/EPUB
- [ ] SPEC-031: Publicar y vender

### EPIC 9.4 — Crecimiento del sistema
- [ ] SPEC-032: Diseñador UX para opciones de libro
- [ ] SPEC-032: Nuevas opciones sin saturar

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
| … | … | … | … | … |

## Notas

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