# AGENTS.md

## Purpose
Futurar is an accessible, AI-assisted platform where people with severe motor
disabilities create, save and dedicate digital products. Books are the first
vertical; designs and presentations follow. Single-switch scanning is the core
of the product, not an optional feature.

## Stack & Commands
Frontend: React 19 + TypeScript + Vite 6 (./), dev server on :3000.
Backend:  NestJS 12 + TypeScript 6 (./backend, Node >= 20.19), API on :3001.
Data/Auth: Supabase. AI: Gemini, reached only through the backend.

Frontend:
`npm install` · `npm run dev` · `npm run build` · `npm run test`
`npm run test:coverage` · `npm run test:e2e` · `npm run typecheck`
`npm run check:supabase`

Backend (run inside ./backend):
`npm run start:dev` · `npm run build` · `npm run lint`
`npm test` (unit) · `npm run test:e2e`

## Structure
./            Frontend (components/ contexts/ hooks/ services/ utils/ types.ts)
./backend     Nest API (src/ai/providers = text/image adapters, dto, jobs)
./backend/src Modules: Auth, Profiles, Books, Admin, Ai

## Non-Negotiable Rules
- Read MEMORY.md at the start of every task; update it before finishing.
- Use Plan Mode for architectural or complex changes; analyze before editing.
- AI NEVER runs in the frontend. No AI SDK, no API key, no prompt in the
  browser. All AI goes through the Nest backend, which owns keys, prompts,
  models, quotas, validation, persistence and audit.
- The frontend stores no secrets and never calls Supabase for data. Backend is
  the only data owner; the frontend uses Supabase Auth for login/refresh only.
- NEVER commit .env* or secrets; NEVER hardcode keys or tokens.
- Validate every AI response server-side against a schema/DTO before persisting.
- Accessibility is non-negotiable: everything must work with one switch;
  pointerdown selects the element actually pressed (a direct click ALWAYS beats
  the scan focus); never take input on release.
- Targets >= 44x44px, text contrast >= 4.5:1, focus contrast >= 3:1, always
  visible focus; honor prefers-reduced-motion/contrast; NEVER block scroll.
- Target WCAG 2.2 AA minimum, ISO/IEC 17549-3 for single-switch, EN 301 549.
- No business logic in React components; no div/span as button; use aria-label.
- i18n from day one: no hardcoded UI strings. UI is es-AR; code, comments,
  identifiers and commits are English (Conventional Commits).
- NEVER commit directly to `main` or `dev`: feature branch from `dev` + PR to
  `dev` + green CI + squash merge; `main` is updated from `dev` at phase close.
- NEVER add a dependency without approval or use `any` without justification.
- No new logic without a test; keep CI green.

## SDD Protocol (Spec-Driven Development)
Every task follows this cycle; no code without an approved spec ("no vibe coding").
1. Read AGENTS.md + MEMORY.md before starting; update MEMORY.md before finishing.
2. Validate APIs, syntax and LTS/stable versions via the Context7 MCP server.
   If Context7 is unavailable, say so and do not invent versions.
3. Report deprecated/outdated code or deps; fold their migration into the spec.
4. Write a SPEC (objective, versions, acceptance criteria, edge cases, file
   impact, contracts) and STOP. Ask: "Do you approve this spec?".
5. Only after approval, implement to the spec, provide verification commands,
   and update MEMORY.md (keep it <= 50 lines).

## Always
Read this file and MEMORY.md first. Inspect before you change. Prefer the
existing patterns in the repo. Ask when a rule blocks you.
