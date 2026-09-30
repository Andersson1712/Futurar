# SPEC-003 — AI HTTP contracts: DTOs, validation, OpenAPI /api/v1, idempotency & auth

- Status: **implemented** (approved by owner 2026-09-30)
- Phase: 1 (Backend as source of truth for AI) / EPIC 1.2
- Depends on: SPEC-002 (AiModule ports/adapters, env validation)
- Blocks: SPEC-004 (prompts), SPEC-005 (output validation), SPEC-006/007
  (jobs/SSE), SPEC-009 (frontend integration)

## Implementation notes
- Approved with decisions D1–D5 as recommended (staging 501, Supabase
  `auth.getUser`, swagger + throttler deps, in-memory idempotency, Swagger off
  in production).
- `setupSwagger` must run **before** `app.listen`; routes registered after
  listen are not served by the Nest 12 / Express 5 adapter.
- TS 6 rejects type-only imports used in decorated signatures (TS1272): DTO
  union types and DI interfaces are imported with `import type`.
- `npm run lint` green; 60 unit tests + 1 e2e; OpenAPI verified live at
  `/api/v1/docs` and `/api/v1/docs-json`.

## Objective
Expose the server-owned AI generation surface with typed contracts:
class-validator DTOs, a stable `AiError` envelope, OpenAPI under `/api/v1`,
required `Idempotency-Key` on generation and Supabase JWT auth. The generation
pipeline itself (prompts, output validation, queue) stays in SPEC-004/005/006;
until those land, `AI_ENDPOINTS_ENABLED` remains `false` and the endpoints
answer `501 NOT_IMPLEMENTED` (contract-first staging). No client-supplied
provider keys anywhere.

## Decisions to confirm (D1–D5)
- **D1 Endpoint staging (recommended)**: SPEC-003 delivers contracts +
  plumbing and a real controller whose use case returns `501
  NOT_IMPLEMENTED` until SPEC-004/005/006. Alternative: merge SPEC-003+004 so
  the endpoint generates end-to-end now (more scope, prompt work moves here).
- **D2 Auth (recommended)**: `SupabaseAuthGuard` verifying the Bearer token
  with the already-installed `@supabase/supabase-js`
  (`client.auth.getUser(token)`), sets `request.user = { id, email? }`.
  Alternative: local JWT verification against Supabase JWKS with `jose`
  (adds a dependency; faster, no network per request).
- **D3 Dependencies**: add `@nestjs/swagger` ^12.0.2 (bundles
  `swagger-ui-dist`; no `swagger-ui-express` needed) and, recommended,
  `@nestjs/throttler` ^6.7.1 (Nest 12 compatible) to protect the re-enabled
  surface from cost abuse.
- **D4 Idempotency (recommended)**: in-memory `IdempotencyService` (TTL 24 h,
  SHA-256 payload hash, conflict on key reuse with a different payload)
  behind an interface; SPEC-006 swaps in Redis/Postgres without contract
  changes.
- **D5 Swagger exposure**: `/api/v1/docs` (UI) and `/api/v1/docs-json`,
  controlled by `SWAGGER_ENABLED` (default: enabled when
  `NODE_ENV !== 'production'`, disabled in production).

## Endpoints (global prefix `/api/v1`)
| Method | Path | Guards | Success | Errors |
|---|---|---|---|---|
| POST | `/ai/books/generate` | throttler → auth → AI flag → idempotency | `202` `GenerateBookResponseDto` (SPEC-006) | 400, 401, 409, 429, 501, 503 |
| GET | `/ai/jobs/:id` | throttler → auth → AI flag | `200` `JobStatusDto` (SPEC-006) | 401, 404, 501, 503 |
| GET | `/` | — | `200` hello (existing AppController) | — |

While the pipeline is pending, POST/GET return `501 NOT_IMPLEMENTED` with the
`AiError` envelope (never a 200 with fake data).

## DTOs (class-validator, `whitelist` + `forbidNonWhitelisted` already global)
```ts
class DedicationDto { to: string (1..80); reason: string (1..200);
  position: 'start' | 'end'; }

class GenerateBookRequestDto {
  protagonist: string (1..120);
  scenery: string (1..120);
  mission: string (1..200);
  style: string (1..80);            // free-text label from student_styles
  storySize: 'small' | 'medium' | 'large';
  customStructure?: string (max 500);
  dedication?: DedicationDto;
  audience?: 'child' | 'teen' | 'adult';   // default child (SPEC-004 prompt)
}

class GenerateBookResponseDto { jobId: string; status: JobStatus; }

class JobStatusDto { id: string; status: 'queued'|'processing'|'completed'|'failed';
  progress?: number (0..100); book?: GeneratedBookDto; error?: AiErrorDto;
  createdAt: string; updatedAt: string; }

class GeneratedBookDto { title: string; totalPages: number;
  pages: GeneratedPageDto[]; }        // { pageNumber, content, imagePrompt? }

class AiErrorDto { statusCode: number; code: AiErrorCode; message: string;
  details?: string[]; }               // no stack, no provider payload, no keys
```

`AiErrorCode` extends SPEC-002 codes with HTTP-layer codes:
`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `IDEMPOTENCY_KEY_REQUIRED`,
`IDEMPOTENCY_KEY_REUSED`, `AI_ENDPOINTS_DISABLED`, `NOT_IMPLEMENTED`,
`VALIDATION_FAILED` (mapped from class-validator errors by an exception
filter; provider errors map from `AiProviderError` via its `code`).

## Idempotency
- `Idempotency-Key` header required on POST (UUID v4 or opaque 8..128 chars;
  invalid → 400 `IDEMPOTENCY_KEY_REQUIRED`).
- Scope: `userId + key`. Replay with same payload hash → same stored
  status/body. Different hash → `409 IDEMPOTENCY_KEY_REUSED`.
- TTL 24 h; lazy eviction. Interface `IdempotencyStore` with
  `InMemoryIdempotencyStore` implementation and tests.

## Environment additions
- `SWAGGER_ENABLED` (boolean, default true outside production).
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (backend-only; already in
  `.env.example`).
- Cross-field boot rule: `AI_ENDPOINTS_ENABLED=true` now requires
  `GEMINI_API_KEY` **and** `SUPABASE_URL` **and** `SUPABASE_SERVICE_KEY`.
- Optional (D3): `THROTTLE_TTL_MS` (default 60000), `THROTTLE_LIMIT`
  (default 60); POST generate override 5/min.

## File impact (backend)
- Dependencies: `@nestjs/swagger` ^12.0.2; optional `@nestjs/throttler`
  ^6.7.1.
- New: `src/common/dto/ai-error.dto.ts`,
  `src/common/filters/ai-exception.filter.ts`,
  `src/common/guards/supabase-auth.guard.ts`,
  `src/common/interceptors/idempotency.interceptor.ts`,
  `src/common/idempotency/{idempotency-store.ts,in-memory-idempotency.store.ts}`,
  `src/supabase/{supabase.module.ts,supabase.service.ts}`,
  `src/ai/dto/*`, `src/ai/ai.controller.ts`,
  `src/ai/application/book-generation.use-case.ts` (501 stub),
  plus specs.
- Update: `src/main.ts` (prefix + Swagger helper + filter/interceptor),
  `src/app.module.ts` (SupabaseModule, ThrottlerModule),
  `src/config/env.validation.ts`, `src/ai/ai.module.ts`,
  `src/ai/guards/ai-endpoints-enabled.guard.ts` (read config instead of raw
  `process.env`, keep 503 semantics), `backend/.env.example`,
  `backend/test/app.e2e-spec.ts` (prefix change).

## Acceptance criteria
1. `npm run build`, `npm test`, `npm run test:e2e`, `npm run lint` green.
2. Invalid body → 400 `VALIDATION_FAILED` with field details; no stack.
3. `AI_ENDPOINTS_ENABLED=false` → 503 `AI_ENDPOINTS_DISABLED`; enabled
   without token → 401; valid (mocked) token → reaches the use case.
4. Missing/invalid `Idempotency-Key` → 400; replay semantics covered by unit
   tests of the store and interceptor.
5. Enabled POST returns 501 `NOT_IMPLEMENTED` (no fake 200) until SPEC-004/005.
6. `SwaggerModule.createDocument` test proves paths + DTO schemas and that
   Swagger is off in production.
7. Boot fails when `AI_ENDPOINTS_ENABLED=true` and Supabase env is missing.
8. Tests mock Supabase and `@google/genai`: zero network.

## Edge cases
Same key with different payload; key reuse across users; expired token;
expired idempotency entry; `AI_ENDPOINTS_ENABLED` toggled at runtime; unknown
job id; `customStructure` at max length; free-text style label; invalid
`audience`; limiter hits → 429 `RATE_LIMITED`.

## Out of scope
Prompts/templates/versioning and option→prompt mapping (SPEC-004), JSON
schema output validation/moderation/limits (SPEC-005), BullMQ jobs + SSE +
persistence (SPEC-006/007/008), frontend integration/i18n error mapping
(SPEC-009), profiles/dedications CRUD (SPEC-021/022), KMS/tenant keys
(SPEC-020), correlation IDs (SPEC-027).

## Verification
`cd backend && npm run build && npm test && npm run test:e2e && npm run lint`;
manual: start with `SWAGGER_ENABLED=true` and check `/api/v1/docs-json`;
confirm 503 with flag off and 501 with flag on + mocked token.
