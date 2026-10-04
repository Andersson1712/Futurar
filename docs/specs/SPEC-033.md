# SPEC-033 — Multi-model generation via OpenRouter (curated catalog)

- Status: **proposed**
- Depends on: SPEC-002 (ports), SPEC-004/005 (prompts/validation),
  SPEC-006/007 (jobs/SSE), SPEC-008 (persistence/audit), SPEC-020
  (per-teacher encrypted credentials), SPEC-027 (metrics/usage),
  SPEC-029 (design vertical consumes the image port)
- Follow-ups: per-teacher model selection UI (033B), tenant budgets
  enforcement (033C)

## Objective

Add OpenRouter as a second AI provider behind the existing
`TEXT_GENERATOR` / `IMAGE_GENERATOR` ports, with a curated model
allowlist per job (script text vs illustration), so each generation step
can use the best model for that job. Gemini stays the default. No
endpoint, DTO, or wizard change.

## Why

Single-vendor lock-in on Gemini caps quality choices: current image
models with distinct strengths (Nano Banana 2 for cost/quality, GPT
Image for precision, Seedream for style) are all reachable through one
OpenRouter key. The ports already abstract providers, so this is a new
adapter pair plus configuration — not a pipeline rewrite. Verified
against OpenRouter docs (Oct 2026): dedicated Image API
(`POST /api/v1/images`, OpenAI-compatible chat completions,
`response_format: json_schema` with strict mode, per-response
`usage.cost` in USD).

## Design

- New `OpenRouterTextAdapter` (port `TEXT_GENERATOR`): `POST
  /api/v1/chat/completions` with `model`, `messages`
  (systemInstruction + prompt), `temperature`, `max_tokens`,
  `response_format: { type: 'json_schema', json_schema: { name, strict:
  true, schema } }` reusing the existing per-vertical schemas, and
  `provider: { require_parameters: true }` so routing only hits
  endpoints honoring the schema. Maps completion `content` →
  `{ text, model, usage }` exactly like the Gemini adapter output shape.
- New `OpenRouterImageAdapter` (port `IMAGE_GENERATOR`): `POST
  /api/v1/images` with `model`, `prompt`, and a normalized subset
  (`aspect_ratio`, `size`, `quality`, `output_format`,
  `input_references`); per-model capabilities read from
  `GET /api/v1/images/models` at config-validation time, never
  free-form passthrough. Maps `data[0].b64_json` → bytes.
- Curated allowlist (config, validated at boot): per vertical
  (`book`, `design`), one text model + one image model, e.g. book text
  `openai/gpt-4o`-class + image Nano Banana 2. Exact slugs pinned at
  implementation after checking `/models` (model names shift; Qwen-class
  image slug unverified — do not assume it). Unknown slugs fail boot
  loudly, same rule as today.
- Credentials: `provider='openrouter'` in `ai_credentials`, reusing the
  AES-256-GCM tenant flow (DB → env fallback, cached by key hash). One
  OpenRouter key serves all models (no per-model keys).
- Migration `0010_openrouter.sql`: widen `ai_credentials.provider`
  check (`gemini` → `gemini,openrouter`) + `cost_usd numeric` on
  `generation_jobs` and `book_versions`/`design_versions`, recorded
  from OpenRouter `usage.cost` (repo has no cost column today — verified
  in `0002_books.sql`). Owner applies 0010.
- Runners unchanged: parser/validator/moderation run identically, so a
  weaker-structured model surfaces as the existing `INVALID_OUTPUT`
  (502) instead of corrupt data. Metrics record tokens + cost.
- TTS stays on Gemini (out of scope). No new npm dependency (native
  `fetch`, 30s+ timeouts for image models — GPT Image high takes ~90s;
  jobs/SSE already tolerate long generations).
- Privacy gate (owner, blocks activation): children's content flows
  through an aggregator with third-party retention policies — review and
  document before `OPENROUTER_ENABLED=true` anywhere but dev.
- Out: per-teacher model picker UI (033B), budget enforcement/caps
  (033C, recording only here), TTS migration, new buckets, prompt
  retuning per model (same prompts; model-specific tuning is 033B+).

## Acceptance criteria

- [ ] Book + design generation run end-to-end on OpenRouter models with
  mocked HTTP (no network): text 202 → job → book/design persisted,
  image bytes stored via the existing storage path.
- [ ] Unknown model slug in config → boot fails loudly (test).
- [ ] `usage.cost` recorded on job + version rows (test with fixture).
- [ ] Failure paths preserved: bad schema output → `INVALID_OUTPUT`
  (502); provider 4xx/5xx → mapped `AiError`, job `failed`, no partial
  persist; idempotent replay unchanged.
- [ ] Gemini default path untouched: existing book/design E2E green.
- [ ] `npm test`, `npm run test:e2e`, `npm run build`, `npm run lint`
  (backend) green. Owner applies 0010.

## Edge cases

- Endpoint without structured-output support: excluded at boot by
  `require_parameters`; runtime fallback stays the tolerant parser, and
  persistent INVALID_OUTPUT is visible in metrics (model re-curation
  signal, not silent corruption).
- Image model parameter mismatch (aspect/size unsupported): validate
  against the discovery catalog at boot; runtime 400 from OpenRouter →
  job `failed` with `AiError`, never a partial book.
- Image latency (~90s high quality): runner has no fixed timeout today;
  assert the suite's shortened-timer pattern still holds, add explicit
  fetch timeout (120s) so hung upstreams cannot wedge a worker.
- `n > 1`, streaming partials, `input_references`: not used in this
  SPEC (single image per call, non-streaming).
- Secrets: OpenRouter key only via `ai_credentials`/env, never logged;
  reuse the credential-redaction test pattern.

## File impact

- New backend: `ai/infrastructure/openrouter/openrouter-text.adapter.ts`
  (+spec), `openrouter-image.adapter.ts` (+spec),
  `openrouter-client.ts` (fetch wrapper, timeouts, error mapping),
  `openrouter.config.ts` (allowlist validation), migration
  `0010_openrouter.sql`, E2E extension with mocked HTTP.
- Touched: `ai.module.ts` (provider selection wiring),
  `env.validation.ts` (`OPENROUTER_ENABLED`, `OPENROUTER_*_MODEL`
  per vertical), cost recording in persistence/metrics paths,
  `odd/tasks/spec-033.md`.
- Out: controllers, DTOs, jobs/SSE, frontend, prompts content.

## Contracts

No HTTP contract change. Internal: adapter output shapes identical to
Gemini adapters; new env flags default off; new `ai_credentials`
provider value `openrouter`.

## Verification

```bash
npm test
npm run test:e2e
npm run build
npm run lint
```

## Versions

Same pins as SPEC-028/029 (`backend/package.json`): Nest 12.x, TS
`^6.0.3`, Jest `^30.0.0` (`NODE_OPTIONS=--experimental-vm-modules`),
Node `>=20.19.0`. OpenRouter API verified via official docs Oct 2026
(Image API, chat completions, structured outputs, provider routing);
re-check `/models` slugs at implementation time.
