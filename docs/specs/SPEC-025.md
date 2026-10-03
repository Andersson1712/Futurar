# SPEC-025 — Public documentation: bilingual README, governance docs, ADRs, guides

- Status: **implemented** (2026-10-01)
- Phase: 7 / EPIC 7.2
- Depends on: SPEC-016 (accessibility declaration), SPEC-024 (governance)
- Blocks: SPEC-026 (public release), external accessibility declaration link

## Objective
Replace the stale AI Studio `README.md` (which still tells users to put
`GEMINI_API_KEY` in the frontend, contradicting AGENTS.md and SPEC-001) with
accurate, human-facing documentation: a bilingual README, contributor/security
docs, an ADR set that records the decisions already made in SPEC-002→024, and
Spanish user/architecture/accessibility/i18n guides. Docs only — no application
code and no runtime dependencies.

## Current state
- `README.md` is the default AI Studio template ("Run and deploy your AI Studio
  app", `GEMINI_API_KEY` in `.env.local`); it is wrong on AI, stack and commands.
- No `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, no `docs/adr/`,
  no user/architecture/i18n guides.
- Rich material already exists to link/derive from: `AGENTS.md`, `MEMORY.md`,
  `plan.md`, `docs/specs/*`, `docs/accessibility/{declaration.es,audit-wcag-2.2,
  iso-17549-3-alignment,en-301-549-applicability}.md`, `docs/security/incident-001.md`.
- Stack (verified): React 19.3 + Vite 6.2 + Vitest 5 + Playwright 1.63;
  NestJS 12.1 + TypeScript 6; Supabase (Auth only in the frontend); Gemini via
  the backend only.

## Decisions to confirm
- **D1 Language policy (recommended)**: `README.md` in **English** with an
  `README.es.md` Spanish translation and a language switcher in both;
  `CONTRIBUTING`/`SECURITY`/`CODE_OF_CONDUCT` in English (open-source default);
  user, architecture and accessibility guides in **Spanish** (`docs/guides/`,
  `docs/architecture/`, `docs/accessibility/`). Alternative: everything
  bilingual (twice the maintenance).
- **D2 Plain Markdown, no site generator (recommended)**: docs live in `docs/`
  and render on GitHub; no Docusaurus/VitePress/MkDocs dependency. Alternative:
  a static docs site (new dependency + CI build; defer until needed).
- **D3 ADRs (recommended)**: create `docs/adr/` with an index and a curated
  MADR-style set reconstructing decisions from SPEC-002→024: 0001 backend owns
  AI and data (no AI in frontend), 0002 NestJS 12 + Supabase Auth only,
  0003 jobs/SSE with `inline|bullmq`, 0004 encrypted per-teacher credentials,
  0005 generic actions/options catalog + per-profile permissions,
  0006 `dev`/`main` governance and squash-only flow. Format: Context, Decision,
  Status, Consequences. Alternative: only the index + future ADRs.
- **D4 README content (recommended)**: what Futurar is (accessible, switch-first
  creation), stack, repo layout, prerequisites (Node >= 20.19), commands
  (frontend + backend), env/AI rules (AI server-side; `AI_ENDPOINTS_ENABLED`
  gate; keys only in the backend), accessibility summary + link to the
  declaration, contributing/security/conduct links and license status
  (pending SPEC-026). It must explicitly remove the `GEMINI_API_KEY` frontend
  instruction.
- **D5 Guides (recommended)**:
  - `docs/guides/docente.es.md`: teacher panel — profiles, active modules,
    actions/options catalog and per-profile limits, contacts/dedications,
    accessibility settings, AI credentials (metadata only).
  - `docs/guides/estudiante.es.md`: student flow — profile pick, menu, wizard
    with scan pages ("Más opciones"), library, reader, dedication, autosave.
  - `docs/architecture/overview.md`: frontend/backend/Supabase split, modules,
    job/SSE flow, data ownership, ports/adapters.
  - `docs/accessibility/guide.es.md`: how a11y is built and verified
    (single-switch, pointerdown rule, targets/contrast, reduced motion, tests),
    linking the declaration and audits.
  - `docs/i18n.md`: current `utils/messages.ts` `t()` layer, es-AR UI vs English
    code/commits, how to add keys, the guard test, and the planned namespace
    extraction.
- **D6 Scope (recommended)**: repository documentation only. Publishing a public
  web page (GitHub Pages) for the accessibility declaration, LICENSE and release
  automation stay in SPEC-026 (or a follow-up). Alternative: include Pages now.

## Contracts
- `README.md` and `README.es.md` share the same section skeleton and cross-links;
  every command shown must exist in `package.json`/`backend/package.json`.
- Each doc starts with a one-line purpose and a "last reviewed" date; links use
  repo-relative paths.
- No doc may instruct putting secrets/keys or AI calls in the frontend; the
  `check:supabase`/AGENTS rules are restated where relevant.
- ADR filenames: `docs/adr/NNNN-kebab-title.md`; index `docs/adr/README.md`.

## File impact
- Replace: `README.md`.
- New: `README.es.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  `docs/adr/README.md` + 6 ADRs, `docs/guides/{docente.es.md,estudiante.es.md}`,
  `docs/architecture/overview.md`, `docs/accessibility/guide.es.md`,
  `docs/i18n.md`, `docs/specs/SPEC-025.md`.
- Update: `plan.md` (EPIC 7.2), `MEMORY.md`, and add a link from
  `docs/accessibility/declaration.es.md` to the public docs (if D6 keeps it
  in-repo).

## Acceptance criteria
1. `README.md`/`README.es.md` describe Futurar accurately, list real commands and
   never mention a frontend API key; the AI-server-only rule is explicit.
2. `CONTRIBUTING.md` documents the workflow (feature branch from `dev` → PR to
   `dev`, Conventional Commits, SDD spec-first, tests/CI, a11y checklist) and
   matches the hooks/CI from SPEC-024.
3. `SECURITY.md` gives a private reporting path and secret-handling rules;
   `CODE_OF_CONDUCT.md` uses Contributor Covenant v2.1 with attribution.
4. `docs/adr/` index + ADRs record the key decisions with status.
5. The four guides exist, are consistent with the implemented behavior, and
   resolve/relocate the "publication deferred to SPEC-025" note (web page still
   out of scope but no longer dangling).
6. All links in the new docs resolve within the repo; no broken references to
   removed files.

## Edge cases
Docs drift vs code (mitigate: link to `AGENTS.md`/specs as source of truth and
review at phase close); the old README URL/banner removed cleanly; Spanish
gender/neutral wording in es-AR; avoiding claims stronger than the WCAG audit
(state "self-assessed, pending user testing"); placeholder for LICENSE until
SPEC-026; keeping `MEMORY.md` <= 50 lines; ADR statuses (`accepted`) reflecting
that they are reconstructed post-hoc, not new decisions.

## Out of scope
GitHub Pages/site generator, LICENSE and versioning/CHANGELOG (SPEC-026),
translating the entire app UI (i18n namespaces are a separate effort),
screenshots/brand assets.

## Verification
Manual review only (docs). Verify: markdown renders without broken relative
links (`scripts/check-docs-links.mjs` optional, or a quick grep); every command
in the READMEs exists in the package manifests; `npm run test`/CI unaffected
(no code changes); `MEMORY.md` still <= 50 lines.

## Implementation notes (2026-10-01)
- Replaced the stale AI Studio `README.md` (it still told users to put
  `GEMINI_API_KEY` in the frontend) with an accurate English README and a Spanish
  `README.es.md` (language switcher, stack, layout, commands, env/AI rules,
  accessibility and doc links; license marked "TBD, SPEC-026").
- Added `CONTRIBUTING.md` (SDD workflow, Conventional Commits, squash-only,
  local checks, a11y checklist), `SECURITY.md` (private reporting, secret rules,
  supported versions) and `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1 with
  attribution + enforcement guidelines).
- Added `docs/adr/` index plus 6 reconstructed ADRs (backend owns AI/data; NestJS
  12 + Supabase Auth only; jobs/SSE with `inline|bullmq`; encrypted credentials;
  actions/options catalog + limits; branch governance).
- Added guides: `docs/guides/docente.es.md`, `docs/guides/estudiante.es.md`,
  `docs/architecture/overview.md` (Spanish), `docs/accessibility/guide.es.md`,
  `docs/i18n.md`. Updated the accessibility declaration and the EN 301 549 note
  so the "publication deferred to SPEC-025" reference no longer dangles.
- Docs only: no code, no dependencies, no CI impact. All relative links resolve
  within the repo; commands match `package.json`/`backend/package.json`.
- Deviations: architecture overview is in Spanish (per D1). Web publishing
  (GitHub Pages), LICENSE and versioning remain in SPEC-026 as planned.
