# SPEC-033B — Per-teacher AI model selection (curated catalog)

- Status: **approved** (owner approved 2026-10-09; D5 split out into SPEC-033D)
- Phase: 9 / EPIC 9.5
- Depends on: SPEC-033 (OpenRouter allowlist), SPEC-020 (encrypted
  credentials), SPEC-021 (profiles/settings), SPEC-027 (metrics/audit),
  SPEC-033D (per-tenant key resolution — split out)
- Blocks: SPEC-033C (tenant budgets)

## Objective

Let a teacher choose, from the curated OpenRouter allowlist, the text and
image models their generations use — persisted server-side and applied
without touching the student flow or the generation endpoints. Today the
model is a single global env value (`OPENROUTER_*_MODEL`) and both
adapters hardcode the `book` vertical, so the configured `design.*`
models are dead and no teacher can differ from the deployment default.

## Why

SPEC-033 shipped one curated model per port behind one env flag. Real
tenants need different quality/cost tradeoffs (a foundation printing
books may want the precise image model; a trial tenant may want the cheap
one), and the wizard neither knows nor should expose model choice.
Selection belongs to the teacher, bounded by the same curated allowlist
so no unvetted slug can ever reach OpenRouter.

## Current behavior (audit)

- Provider is chosen once at boot by `OPENROUTER_ENABLED`
  (`ai.module.ts:176-192`); the model comes from env and both adapters
  hardcode the `.book` keys (`openrouter-text.adapter.ts:45-46`,
  `openrouter-image.adapter.ts:36-37`), so `design.*` in
  `openrouter.config.ts:63-72` is read by nobody.
- `TextGenerationRequest` / `ImageGenerationRequest` carry no `model` or
  `vertical` (`domain/ports/text-generator.port.ts:1-8`,
  `image-generator.port.ts:3-8`).
- The allowlist lives in `openrouter.config.ts:13-27` (1 text + 3 image
  slugs); `resolveOpenRouterConfig` runs lazily per request and only
  validates env values, never a request-time one.
- No teacher-level settings storage: `teachers` is
  id/email/name/role/avatar (`0000_bootstrap.sql:22-30`); only per-student
  `student_settings` exists. A per-teacher preference needs a migration.
- Per-tenant `OPENROUTER_API_KEY` resolution and the Gemini-only typed
  provider surface are handled by **SPEC-033D** (split out of this spec);
  033B assumes it.
- Cost is stored per job/version but metrics have no model dimension, and
  the image adapter returns no `usage.costUsd`
  (`openrouter-image.adapter.ts:64-68`).

## Decisions to confirm

- **D1 Storage (recommended)**: new migration
  `0014_teacher_ai_settings.sql` adds `teacher_ai_settings`
  (`owner_id uuid unique`, `text_model text`, `image_model text`,
  `updated_at`) instead of columns on `teachers`; keeps `teachers` lean,
  auditable and easy to extend for 033C budgets. Alternative: a jsonb
  column on `teachers`.
- **D2 Catalog source (recommended)**: the curated constant in
  `openrouter.config.ts` is the single source of truth, exposed read-only
  via `GET /api/v1/ai/models`. No live `GET /models` passthrough — the
  teacher only ever picks a vetted slug.
- **D3 Precedence + validation (recommended)**: `teacher preference →
  env default per vertical → hard default`; every resolved slug is
  validated against the allowlist at both write and read; a stale stored
  slug (model retired from the allowlist) falls back to the env default
  with a warning metric instead of failing generation.
- **D4 Selection scope (recommended)**: v1 selects ONE text + ONE image
  model per teacher, applied to all their verticals. The port gains an
  explicit `vertical` so the adapters stop hardcoding `book` and use the
  per-vertical env default when no teacher preference exists.
  Per-vertical pairs (separate book/design choices) are a follow-up.
- **D5 Provider switch stays env**: 033B chooses among OpenRouter slugs
  only; whether OpenRouter is active at all remains `OPENROUTER_ENABLED`
  (the owner privacy gate). Gemini's own model stays env-configured.
- **D6 Frontend (recommended)**: a model picker in the teacher panel's
  credentials tab (`components/ApiKeyPanel.tsx`, or a new
  `AiModelPanel.tsx`) fed by `GET /ai/models` and saved via
  `PUT /ai/model-preferences`; hidden/disabled unless OpenRouter is
  enabled; full i18n via `t()`.

## Contract

- `GET /api/v1/ai/models` → 200
  `{ text: string[]; image: string[]; defaults: { text: string; image: string } }`
  (teacher auth).
- `GET /api/v1/ai/model-preferences` → 200
  `{ textModel?: string; imageModel?: string }` (defaults when unset).
- `PUT /api/v1/ai/model-preferences` body
  `{ textModel?: string; imageModel?: string }` → 200 saved; 422
  `INVALID_MODEL` when a slug is outside the allowlist; reuse the
  `AiError` envelope.
- Student generation endpoints (`POST /ai/books/generate`,
  `POST /ai/designs/generate`, …) keep their exact contract — model
  selection is server-side only.
- Internal: `TextGenerationRequest` / `ImageGenerationRequest` gain
  `vertical: 'book' | 'design'`; adapters resolve the slug through the new
  `ModelSelectionService`.

## File impact

- New backend: `ai/application/model-selection.service.ts` (+spec),
  `ai/application/teacher-ai-settings.repository.ts` (+spec) with a
  Supabase adapter, `ai/dto/model-preference.dto.ts`,
  `ai/model-catalog.controller.ts` (or extend
  `ai-credentials.controller.ts`), migration
  `0014_teacher_ai_settings.sql`.
- Touched: `domain/ports/{text,image}-generator.port.ts` (+`vertical`),
  `infrastructure/openrouter/openrouter.config.ts` (export the catalog +
  accept a validated override), both OpenRouter adapters (resolver +
  `vertical`, image `costUsd`), `generation-runner.ts` /
  `design-generation.runner.ts` (+`vertical`), `ai.module.ts` wiring,
  metrics model dimension.
- New frontend: `services/backendModels(.test).ts`, `AiModelPanel.tsx`
  (+test), TeacherPanel tab wiring, i18n keys.
- Out: per-tenant key resolution and provider-union widening (SPEC-033D),
  budget enforcement (033C), Gemini model picking, new providers, prompt
  retuning per model, billing UI.

## Acceptance criteria

- [ ] Teacher sets a text/image model from the curated list → persisted
  and applied to their next generation (unit + E2E with mocked HTTP).
- [ ] `PUT` with a non-allowlisted slug → 422 `INVALID_MODEL`, nothing
  persisted.
- [ ] Stale stored slug → falls back to the env default with a warning;
  generation still succeeds.
- [ ] Adapters use the request `vertical`; the `design.*` env models are
  actually honored (regression test proves the dead config is fixed).
- [ ] A teacher with no stored preference and only the env key still
  generates (unchanged fallback); per-tenant key resolution is SPEC-033D.
- [ ] Student flow untouched: existing book/design/presentation/board E2E
  green; no generation DTO change.
- [ ] Image cost recorded when OpenRouter reports it.
- [ ] Backend `npm test`, `npm run test:e2e`, `npm run build`,
  `npm run lint` green; frontend `typecheck` 0 new errors + Vitest green
  (MSW). Owner applies 0014.

## Edge cases

- Preference set while OpenRouter is disabled → stored but inert; applied
  when the flag turns on.
- `teacher_ai_settings` row absent → env defaults.
- Concurrent PUTs → last write wins (single-row upsert).
- Retired slug in an old stored preference → fallback, never a failed job.
- Teacher with no credential row → env fallback (unchanged behavior).
- Metrics without a `tenantId` (background job) → env default.

## Out of scope

Per-tenant key resolution / provider-union widening (SPEC-033D), tenant
budget caps (033C), usage dashboards, Gemini model selection, per-vertical
pairs (D4 follow-up), prompt retuning per model, publishing/selling.

## Verification

```bash
# backend
npm test
npm run test:e2e
npm run build
npm run lint
```

```bash
# frontend
npm run typecheck   # 0 new errors (pre-existing baseline documented since 029B)
npm test            # Vitest + MSW
```

Manual: the teacher panel picker persists across reload; generation uses
the selected model (assert in logs/metrics); the panel hides when the
flag is off.

## Versions

No new dependency expected; same pins as SPEC-033/SPEC-031 (Nest 12.x,
TS `^6.0.3`, Jest `^30.0.0`, Node `>=20.19.0`). Re-check OpenRouter model
slugs against `/models` at implementation time; the curated allowlist is
the only accepted set.
