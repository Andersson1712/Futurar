# SPEC-004 — Server-owned prompts: versioned templates and option→prompt mapping

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D4 as recommended)
- Phase: 1 / EPIC 1.3
- Depends on: SPEC-002 (TextGeneratorPort), SPEC-003 (GenerateBookRequestDto)
- Blocks: SPEC-005 (output validation), SPEC-006 (jobs/pipeline wiring)

## Implementation notes
- `book/v1` lives in `src/ai/prompts/book/v1/` (`book.prompt.ts`,
  `book.schema.ts`, `BOOK_PROMPT_VERSION`), consumed by
  `PromptBuilderService` (application layer).
- Story sizes are 5/10/15 pages with per-page word ranges (small 80–120,
  medium 100–150, large 120–180); audience defaults to `child`.
- `GeneratedBookDto` gained optional `dedication` (SPEC-004 D3); the model
  writes the text, `position` stays in the request.
- `responseJsonSchema` is passed to Gemini; server-side validation is
  SPEC-005.

## Objective
Move prompt building from the (deleted) frontend/backend prototypes into a
single server-owned, versioned `PromptBuilder`: synopsis options, story size,
custom structure, dedication and audience become a deterministic prompt plus a
JSON schema for structured output. No provider keys or prompts ever leave the
backend.

## Decisions to confirm
- **D1 Story structure (recommended)**: the contract already exposes
  `pages`. Map `small|medium|large` → **5/10/15 pages** (matches the current
  config UI) with per-page word guidance. Legacy used 3/5/10 chapters; the
  page mapping wins to keep one structure everywhere.
- **D2 Response format**: the prompt instructs plain JSON (no markdown) and
  `responseJsonSchema` is passed to Gemini for structured output. Validation
  of that output is SPEC-005.
- **D3 Dedication output**: add optional `dedication?: string` to
  `GeneratedBookDto` (the model writes the text; `position` stays in the
  request and is applied by the frontend/reader). Alternative: weave it into
  the first/last page without touching the contract.
- **D4 Audience mapping**: `child|teen|adult` (default `child`) map to tone,
  vocabulary and theme guidance in the prompt. Frontend does not collect it
  yet (SPEC-021 will); default keeps current behavior.

## Contracts
```ts
interface BookPrompt {
  version: string;              // 'book/v1'
  systemInstruction: string;
  prompt: string;
  responseJsonSchema: Record<string, unknown>;
}

class PromptBuilderService {
  build(command: GenerateBookCommand): BookPrompt;
}
```
- Story size specs (editable per version):
  - `small`: 5 pages, 80–120 words/page
  - `medium`: 10 pages, 100–150 words/page
  - `large`: 15 pages, 120–180 words/page
- Prompt rules: award-winning children's author persona, no markdown, mission
  completed, positive morality, dialogues and sensory details, 2–3 paragraphs
  per page, `imagePrompt` per page, language es-AR.
- Dedication (when present): model returns `dedication` text honoring
  `to`/`reason`; never quote private data beyond what the user provided.
- `audience` guidance:
  - `child`: simple vocabulary, warm tone, no violence or scary content.
  - `teen`: richer vocabulary, adventure/emotion allowed within limits.
  - `adult`: literary tone, no children's framing.
- `customStructure` (≤500 chars) is appended as additional instructions.

## File impact (backend)
- New: `src/ai/prompts/book/v1/{book.prompt.ts, book.schema.ts, index.ts}`
  (versioned templates + `BOOK_PROMPT_VERSION`),
  `src/ai/application/prompt-builder.service.ts`, specs.
- Update: `src/ai/dto/generated-book.dto.ts` (D3 if approved),
  `src/ai/ai.module.ts` (provide/export `PromptBuilderService`).
- No endpoint behavior change in this spec.

## Acceptance criteria
1. `build()` returns version `book/v1`, a system instruction and a prompt that
   includes protagonist, scenery, mission, style, page/word guidance,
   custom structure (when present), dedication (when present) and audience
   guidance.
2. The prompt explicitly demands JSON with `title` + `pages[]`
   (`pageNumber`, `content`, `imagePrompt`) and forbids markdown.
3. `responseJsonSchema` matches that format.
4. Unit tests cover: default size/audience, all three sizes, dedication
   start/end, custom structure, audience variants, version constant.
5. `npm run build`, `npm test`, `npm run lint` green; tests assert prompt
   fragments, no snapshots that break on copy edits.

## Edge cases
Empty/whitespace `customStructure`; dedication with quotes/newlines; audience
omitted (defaults to child); max-length strings from DTO validation;
storySize/language fixed to es-AR; future prompt versions must not mutate
`book/v1`.

## Out of scope
Output parsing/validation/moderation/limits (SPEC-005), queue/jobs/persistence
(SPEC-006/007/008), image prompt expansion per page, i18n of prompts (future
vertical/language spec), frontend wiring (SPEC-009).

## Verification
`cd backend && npm run build && npm test && npm run lint`.
