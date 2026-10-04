# SPEC-029 — New verticals: framework + Diseños (flyers)

## Objective
Extract the reusable generation pipeline and ship Diseños (flyers) through
the same accessible wizard. Presentaciones (029B) and Comunicación (029C)
follow the same pattern later.

## Why
Every pipeline seam is book-shaped today. Cloning it per vertical triples
prompt drift, moderation gaps, and wizard forks. One vertical done right
sets the pattern.

## Scope
- Backend `prompts/design/v1`, DTOs/types, prompt-builder, parser/validator,
  runner, `designs` module, migration `0009_designs.sql`, endpoints
  `POST /ai/designs/generate` + `GET/DELETE /designs`, E2E with mocked Gemini.
- Frontend `backendDesigns.ts`, wizard entry + library merge, i18n keys, tests.
- Reuse untouched: jobs, SSE, idempotency, correlation, metrics, guards shape.
- Out: presentaciones, comunicación, export (SPEC-031), new buckets, new deps.

## Tasks
- [ ] 029-1 Validate new APIs via Context7; confirm mock boundary + 0009 shape
- [ ] 029-2 Backend: prompts/design/v1 + DTOs + builder + parser/validator (RED→GREEN)
- [ ] 029-3 Backend: runner + designs module + endpoints + migration 0009 + E2E
- [ ] 029-4 Frontend: service + wizard entry + library merge + i18n + a11y tests
- [ ] 029-5 Full verification (be: test/e2e/build/lint; fe: typecheck/check/test) +
  docs + MEMORY.md (<=50 lines); book E2E still green
- [ ] 029-6 Push + PR to `dev` (needs user approval — publishing)

## Route
Delegated-direct unavailable in this runtime (provider refused on earlier
SPECs); proceeding direct-inline in bounded batches, disclosed here.
Writer trigger will fire at implementation (2+ non-trivial files) — if the
provider still refuses, continue inline with disclosure as before.

## Verification evidence
- (pending)

## Commits
- (pending) branch `feat/spec-029-designs`

## Next
SPEC approval first (SDD). Only after approval, implement to this spec.
