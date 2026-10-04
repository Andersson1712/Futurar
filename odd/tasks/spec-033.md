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
- [ ] 033-1 Validate slugs against `/models` + Image discovery; pin allowlist
- [ ] 033-2 Text adapter + spec (RED→GREEN, strict schema, error mapping)
- [ ] 033-3 Image adapter + client + config validation + specs
- [ ] 033-4 Migration 0010 + cost recording + metrics
- [ ] 033-5 E2E (mocked HTTP) + full verification + docs + MEMORY.md
- [ ] 033-6 Push + PR to `dev` (needs user approval — publishing)

## Route
Direct-inline or one bounded writer per ODD triggers at implementation.

## Verification evidence
- (pending)

## Commits
- (pending) branch `feat/spec-033-openrouter`

## Next
SPEC approval first (SDD). Only after approval, implement to this spec.
