# SPEC-033 — Multi-model generation via OpenRouter (curated catalog)

## Objective
OpenRouter as second provider behind the existing ports, with a curated
model allowlist per job (script text vs illustration). Gemini stays
default. No endpoint, DTO, or wizard change.

## Why
Single-vendor lock-in caps quality choices; the ports already abstract
providers, so this is adapters + config, not a rewrite.

## Scope
- `openrouter-text.adapter` (chat + json_schema strict + require_parameters),
  `openrouter-image.adapter` (Image API + capability discovery),
  client wrapper, allowlist config, migration 0010 (provider check + cost
  columns), cost recording, E2E with mocked HTTP, privacy-gate note.
- Reuse untouched: runners, parser/validator/moderation, jobs/SSE,
  idempotency, credentials flow, TTS on Gemini.
- Out: per-teacher picker UI (033B), budget enforcement (033C), TTS,
  model-specific prompt tuning, `n > 1`/streaming.

## Tasks
- [x] 033-1 Slugs pinned against live catalog (parent): text
  `google/gemini-3.8-flash`, image `google/gemini-3.1-flash-image`;
  alternates `openai/gpt-image-2`, `qwen/qwen-image-3-pro`
- [x] 033-2 Text adapter + spec (RED→GREEN)
- [x] 033-3 Image adapter + client + config validation + specs
- [x] 033-4 Migration 0010 + cost recording end-to-end (ports typed,
  runners→metrics, job recordCost, audit mappings, credentials allowlist)
- [x] 033-5 E2E (mocked HTTP) + full verification (see evidence)
- [ ] 033-6 Push + PR to `dev` (needs user approval — publishing)

## Route
Direct-inline or one bounded writer per ODD triggers at implementation.

## Verification evidence (final)
- `npm test` (backend/): 60 suites / 316 tests pass (incl. 16 openrouter +
  cost-threading specs; Gemini default path green).
- `npm run test:e2e` (backend/): 4 suites / 22 tests pass (incl. 4 new
  `ai-openrouter.e2e-spec`: book text+cost, design text+image,
  500→PROVIDER_UNAVAILABLE/503 no partial book, bad schema→INVALID_OUTPUT).
- `npm run build` (backend/): clean (parent spot-checked).
- `npm run lint` (backend/): clean; unrelated `--fix` hunk in
  `ai-endpoints-enabled.guard.spec.ts` reverted by parent.
- RED→GREEN: 3 openrouter suites failed pre-impl (`Cannot find module`),
  16/16 post-impl; 2 cost tests failed pre-impl, green post-impl.

## Known gaps (residual, for 033B+)
- Supabase `cost_usd` writes require migration 0010 applied (reads
  tolerate via optional fields); owner applies 0010.
- `CredentialProvider` nominal union type + controller enum stay
  `gemini`-only (runtime passes openrouter through; widen in 033B).
- Single shared adapter instance serves book-vertical models; design
  entries boot-validated, selection deferred to 033B.
- Privacy gate: children's content via aggregator needs owner review
  before `OPENROUTER_ENABLED=true` outside dev.

## Commits (feat/spec-033-openrouter, rebased onto dev @ 8d57328)
- 4837561 feat(ai): OpenRouter client + strict-schema text adapter + specs
- f5d3654 feat(ai): image adapter + allowlist config + specs
- a52ccf8 feat(ai): provider selection wiring + env flags (Gemini default)
- ea3be2d feat(db): migration 0010 + cost_usd recording
- 48b9f1e test(e2e): mocked-HTTP suite + bootstrap
- 0f4742a feat(ai): cost ports + runners + metrics + job recordCost + specs
- 84df50f feat(books,designs,credentials): cost_usd audits + openrouter allowlist + specs

## Next
PR #41 open to `dev` (https://github.com/Andersson1712/Futurar/pull/41) — awaiting review/merge. Owner applies 0010; privacy review before enabling outside dev.
