# Visión de arquitectura

> Última revisión: 2026-10-01 · Fuente de verdad: [`AGENTS.md`](../../AGENTS.md),
> [`MEMORY.md`](../../MEMORY.md) y los [specs](../specs/).

## Principio rector

El **backend es el único dueño de la IA y de los datos**; el **frontend** es UI +
**Supabase Auth**. Toda operación con IA, validación, cuota, persistencia y
auditoría vive en el backend NestJS. El navegador nunca ve claves ni prompts.

```
Navegador (React 19 + Vite)
  │  login/refresh (Supabase Auth)                         │  fetch + JWT
  ▼                                                        ▼
Supabase Auth  ───────────────────────────────►  API NestJS (NestJS 12, /api/v1)
                                                    │            │
                                       Supabase (Postgres)   Gemini (solo backend)
```

## Componentes

| Componente | Responsabilidad |
|---|---|
| Frontend (raíz) | Componentes accesibles con barrido, contextos, hooks, `services/backend*` |
| Backend `src/ai` | Puertos de dominio + adaptadores Gemini (texto/imagen/TTS), prompts versionados, validación |
| Backend `src/jobs` | Generación asíncrona, SSE, reintentos, circuit breaker, idempotencia |
| Backend `src/books` | Persistencia y versionado de libros, soft delete, URLs firmadas de imágenes |
| Backend `src/profiles` | Perfiles, settings de accesibilidad, contactos/dedicatorias, favoritos |
| Backend `src/actions` | Catálogo Acción → Opción → Ítem y permisos por perfil |
| Backend `src/admin` | Credenciales de IA por docente (metadata) |
| Supabase | Postgres + Auth + Storage (bucket privado de imágenes) |

## Puertos y adaptadores

- `src/ai/domain/ports` define las interfaces (`TextProvider`, `ImageProvider`,
  `TtsProvider`); `src/ai/providers/gemini` implementa los adaptadores.
- Los repositorios tienen versión **Supabase** y **in-memory** (fallback de dev y
  CI). Deben comportarse igual: los tests cubren la paridad.
- La selección se hace por configuración (`SupabaseService.getClient()`,
  `QUEUE_DRIVER`).

## Flujo de generación (jobs + SSE)

1. `POST /api/v1/ai/books/generate` (con `Idempotency-Key`) valida el DTO, resuelve
   defaults del perfil y encola un job.
2. El worker (inline o BullMQ) llama al proveedor, valida la salida contra el
   schema, modera por audiencia y persiste el libro (`books`/`book_versions`).
3. El cliente sigue `GET /ai/jobs/:id/events` (SSE con auth por header) y cae a
   polling si hace falta. Imágenes opcionales en bucket privado con URLs firmadas
   (nunca persistidas).

## Contratos y errores

- API bajo `/api/v1` con Swagger (apagado en producción) y validación global
  (`class-validator`, rechazo de claves desconocidas).
- Envoltura de error `AiError`: `{ statusCode, code, message, details? }`.
- Códigos relevantes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
  `VALIDATION_FAILED`, `LIMIT_EXCEEDED`, `PROVIDER_UNAVAILABLE`, etc.
- Endpoints públicos (sin auth): `GET /profiles/active` (quiosco de
  estudiantes; `notes` del docente excluidas por whitelist) y
  `GET /health` (liveness). Todo lo demás exige JWT del docente.

## Observabilidad

- Logs JSON estructurados (`nestjs-pino`); nivel por `LOG_LEVEL`
  (`debug|info|warn|error`, default `info`).
- Correlation ID de punta a punta: se respeta `x-correlation-id`, si no llega
  se genera UUID, se devuelve en cada respuesta y viaja
  `controller → comando → cola → runner` a todos los logs del job.
  Los headers de credenciales se redactan en los logs.
- Métricas en memoria en `GET /metrics` (solo docente; se reinician con cada
  deploy): requests por familia de estado + latencia, jobs de generación
  (éxito/fallo, latencia, tokens de entrada/salida).
- Umbrales de alerta sugeridos en [`../ops/alerts.md`](../ops/alerts.md)
  (sin infraestructura de envío todavía).

## Accesibilidad en la arquitectura

- El barrido vive en `ScanningGrid` + `useInputDevice`; el contrato de entrada es
  `pointerdown` sobre `[data-option]` (el clic gana al foco del barrido).
- No hay `overflow: hidden` global; layout con `100dvh` y `touch-action: pan-y`.
- La configuración por perfil (velocidad, voz, tamaño, módulos) se persiste vía
  backend (`student_settings`) y se aplica en `<html>`/contextos.
- Ver la [guía de accesibilidad](../accessibility/guide.es.md) y la
  [declaración](../accessibility/declaration.es.md).

## Datos

- Tablas principales: `actions`, `action_options`, `action_option_items`,
  `profile_actions`, `profile_option_items`, `profiles`/`students`,
  `profile_contacts`, `student_settings`, `books`, `book_versions`,
  `generation_jobs`, `ai_credentials`.
- Migraciones en `backend/supabase/migrations/` (aplicar en orden). El frontend
  solo lee/usa Supabase Auth; `npm run check:supabase` lo garantiza.
