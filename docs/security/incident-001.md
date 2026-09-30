# Security incident report: exposed AI provider access in the frontend

- **Incident ID:** INC-001
- **Date opened:** 2026-09-30
- **Severity:** High (credential exposure + unauthenticated AI proxy)
- **Status:** Contained (code remediation merged via SPEC-001; manual rotation pending)
- **Owner:** Andersson1712

## Summary
The frontend contained direct AI provider integrations, prompt templates and
API-key handling. Provider keys could be supplied by the user, stored in
`localStorage` and in Supabase, injected into the production bundle, or typed
into a teacher modal. A `Gemini` API key was configured in the frontend
environment. The Nest backend also exposed unauthenticated AI endpoints that
accepted a client-provided `apiKey`.

## Scope of exposure
- Bundle/build: `vite.config.ts` injected `GEMINI_API_KEY` as
  `process.env.API_KEY` / `process.env.GEMINI_API_KEY` into the client bundle.
- Browser storage: `futurar_ai_config` and `futurar_gemini_key` in
  `localStorage`, written by `GlobalConfigModal`.
- Database: `ai_config` table stored provider keys in plain text, written by the
  frontend through `@supabase/supabase-js`.
- Client-side provider calls: `services/ai.ts` called OpenAI, Anthropic, Groq
  and Together AI directly with keys from browser storage, and embedded the
  story prompt.
- Backend: `POST /ai/story`, `POST /ai/image` and `POST /ai/validate-key` had no
  auth guard and accepted `apiKey` in the request body (open proxy / cost abuse).
- Repository: `.env` was tracked in git. No real-looking Gemini key was found in
  the file history (search pattern `AIza[0-9A-Za-z_-]{30,}`, 0 matches); the
  tracked file contained the Supabase anon (public client) key.

## Root cause
The initial prototype prioritized speed and ran AI entirely in the browser,
with keys treated as user settings instead of server secrets. There was no
architectural rule (or enforcement) that AI must run server-side.

## Remediation (SPEC-001)
- Deleted `services/ai.ts` and `services/gemini.ts`; removed the AI SDK from the
  frontend dependency tree.
- Removed key injection from `vite.config.ts`; removed AI variables from `.env`
  and `.env.example`; documented that AI keys live only in the backend.
- Reworked `GlobalConfigModal` to manage only non-secret story settings.
- Gated `POST /ai/*` endpoints behind `AiEndpointsEnabledGuard`
  (`AI_ENDPOINTS_ENABLED`, default disabled) with a unit test.
- Added `.env` to `.gitignore`, untracked `.env`, added `CODEOWNERS` freeze and
  the non-negotiable rule in `AGENTS.md`.

## Manual actions pending (owner: Andersson1712)
- [ ] Revoke the exposed Gemini API key in Google AI Studio.
- [ ] Create a new key and store it only in the backend secret store.
- [ ] Purge provider key values from the `ai_config` table in Supabase.
- [ ] Verify with a fresh build that no key material is present in `dist/`.

## Follow-ups
- SPEC-002/003: backend owns prompts, DTOs and key handling; re-enable endpoints.
- SPEC-009: frontend generation via backend only.
- SPEC-010: remove all direct Supabase data access from the frontend.
- Consider purging the Supabase anon key from git history (public key; low risk).
