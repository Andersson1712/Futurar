# SPEC-005 — AI output validation, moderation and limits

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D3 as recommended)
- Phase: 1 / EPIC 1.4
- Depends on: SPEC-004 (PromptBuilder + JSON format)
- Blocks: SPEC-006 (job pipeline), SPEC-008 (persistence), SPEC-009 (frontend)

## Implementation notes
- D1: internal `class-validator` DTO + deterministic limits (`BOOK_LIMITS`);
  no new dependencies. D2: `BookGenerationService` runs generation
  synchronously with an in-memory `JobRegistry` (24 h TTL, per-user), so the
  endpoint is functional when `AI_ENDPOINTS_ENABLED=true`; SPEC-006 swaps the
  registry for BullMQ/Redis/Supabase. D3: `INVALID_OUTPUT` → 502.
- `totalPages` is computed server-side from `pages.length`; extra model fields
  are stripped by the validator.
- Moderation uses normalized whole-word blocklists per audience (child
  strictest). Input moderation runs before the provider (`INVALID_REQUEST`);
  output violations → `CONTENT_BLOCKED`; matched terms are never echoed.
- Post-generation failures mark the job `failed` and still return the
  `AiError` envelope to the client (no fake 202).

## Objective
Never trust model output: parse it, validate it server-side against a strict
schema, apply audience moderation and enforce size/token limits before the
book is returned or persisted. Reuse existing `class-validator` (no new deps)
and pass a JSON schema to Gemini for structured output (SPEC-004).

## Decisions to confirm
- **D1 Validation tech (recommended)**: internal `class-validator` DTO +
  deterministic checks, reusing the JSON schema from SPEC-004 for structured
  output. Alternative: strict `ajv` validation (adds a direct dependency;
  currently only present transitively).
- **D2 Wiring now (recommended)**: implement a synchronous
  `BookGenerationService implements BookGenerationUseCase` with an in-memory
  job registry, so `POST /ai/books/generate` actually generates and
  `GET /ai/jobs/:id` returns `completed` + book. SPEC-006 replaces the
  registry with BullMQ/Redis/Supabase without contract changes. Alternative:
  keep the 501 stub until SPEC-006.
- **D3 Error codes**: add `INVALID_OUTPUT` (502, provider returned unusable
  content) and reuse `CONTENT_BLOCKED` (422) for moderation failures.

## Contracts
```ts
class BookOutputParser {
  parse(text: string): unknown;        // strips fences/prose, extracts JSON
}

class BookOutputValidator {
  validate(payload: unknown, audience: Audience): GeneratedBookDto;
}

interface JobRegistry {
  create(userId: string): JobRecord;               // queued
  complete(jobId: string, book: GeneratedBookDto): void;
  fail(jobId: string, error: AiErrorDto): void;
  find(jobId: string, userId: string): JobRecord | undefined;
}

class BookGenerationService implements BookGenerationUseCase {}
```
- Validation rules: `title` 1..120; `1..15` pages; `pageNumber` sequential
  1..n; `content` 1..2000 chars; `imagePrompt` ≤300 chars optional;
  `totalPages` equals `pages.length`; total content ≤20k chars; reject
  duplicate/empty pages. Errors → `INVALID_OUTPUT` without echoing raw model
  text.
- Moderation (per audience, deterministic): normalized whole-word blocklists
  (violence/sexual/self-harm terms); `child` strictest, `teen` moderate,
  `adult` minimal (still blocks illegal content). Violations →
  `CONTENT_BLOCKED` with a generic message; the matched term is not exposed.
- Moderation of user input (protagonist/scenery/mission) happens here too
  before calling the provider (same blocklists, mapped to `INVALID_REQUEST`).
- Limits are constants in one module (`BOOK_LIMITS`) and covered by tests.
- In-memory registry (D2): per-user scoping, TTL 24h, `queued → completed |
  failed`; stores `GeneratedBookDto` exactly once. Note: single-instance only
  until SPEC-006.

## File impact (backend)
- New: `src/ai/application/{book-output.parser.ts, book-output.validator.ts,
  in-memory-job.registry.ts, book-generation.service.ts}` + specs.
- Update: `src/ai/ai.module.ts` (bind `BOOK_GENERATION_USE_CASE` to
  `BookGenerationService` when D2 approved; otherwise keep stub),
  `src/common/ai/ai-error-code.ts` (+`INVALID_OUTPUT`),
  `src/common/filters/ai-exception.filter.ts` (map it to 502),
  `src/ai/dto/generate-book-response.dto.ts` (dedication field if SPEC-004 D3).
- Tests mock `TextGeneratorPort`: zero network.

## Acceptance criteria
1. Parser handles: clean JSON, fenced JSON (```json ... ```), JSON embedded in
   prose, and invalid input (throws `INVALID_OUTPUT`).
2. Validator rejects: missing title, 0 or >15 pages, non-sequential
   `pageNumber`, oversized page/total content, wrong `totalPages`, empty
   content; accepts valid books for all audiences.
3. Moderation rejects child-inappropriate output and input before generation,
   without leaking matched terms or raw content.
4. (D2) With `AI_ENDPOINTS_ENABLED=true` and a mocked text provider, POST
   returns 202 and GET returns `completed` + validated book; provider
   failure marks the job `failed` and maps to `AiErrorDto`.
5. Limits and moderation rules have dedicated unit tests; build/test/lint
   green; no real Gemini calls.

## Edge cases
Model returns markdown around JSON; duplicated `pageNumber`; `totalPages`
mismatch; content with banned words in innocuous contexts (documented
limitation); empty/whitespace pages; dedication text with banned terms;
registry TTL expiry; two jobs for the same user; audience omitted (child).

## Out of scope
Async queue/SSE/retries (SPEC-006/007), persistence/audit/signed URLs
(SPEC-008), LLM-based moderation and profile-driven limits (SPEC-021/023),
image generation per page.

## Verification
`cd backend && npm run build && npm test && npm run test:e2e && npm run lint`;
manual (D2): boot with dummy Supabase env, enable AI, POST with a mocked or
real provider and check `GET /ai/jobs/:id`.
