# SPEC-002 — Nest AiModule: Text/Image/Tts ports, Gemini adapters, env & secrets

- Status: approved by owner (2026-09-30)
- Phase: 1 (Backend as source of truth for AI)
- Depends on: SPEC-001 (AI removed from frontend, endpoints gated)
- Blocks: SPEC-003 (DTOs/contracts), SPEC-004 (prompts), SPEC-005 (output validation)

## Objective
Turn `backend/src/ai` into a hexagonal module with generation ports (text,
image, TTS), Gemini adapters that use **server-owned keys only**, boot-time
environment validation, and a `SecretProvider` (env for dev; KMS/tenant keys
are SPEC-020). Remove the legacy controller/service/providers/DTOs that
accepted a client-supplied `apiKey` (INC-001 remediation).

Also (added on owner request): upgrade the backend to NestJS v12 and the
frontend to React 19.3, folding the outdated-dependency migration into this
spec.

## Version findings (validated 2026-09-30)
- `@google/genai` installed 1.39.0 → target ^2.25.0. Changelog: v2.0.0 breaking
  changes are Interactions-API-only; `generateContent` is unaffected. SDK is
  dual CJS/ESM (`require` → `dist/node/index.cjs`), safe for a CJS Nest app.
- Deprecated/hardcoded models in current code: `gemini-1.5-pro` (retired),
  `gemini-2.0-flash`. Current stable defaults: text `gemini-3.8-flash`
  (GA 2026-09), image `gemini-3.1-flash-image` (Nano Banana 2;
  `imagen-4.0-generate` appears as deprecated), TTS `gemini-3.8-flash-tts`
  (GA 2026-07).
- Gemini TTS does not support es-AR: es-ES GA, es-419/es-MX preview. Default
  `es-419`, limitation documented (consistent with MEMORY.md).
- NestJS 11 → 12.1.2 (owner request). v12 packages are ESM-only; CJS apps run
  via `require(esm)` on Node >= 20.19 / 22.12 (Node 24.20 installed). Jest can
  load v12 packages on Node >= 24.9 (we are on 24.20). `nest upgrade` requires
  TypeScript v6 (target 6.0.3); ts-jest 29 supports `>=4.3 <7`.
- `@nestjs/config` 12.0.1: ESM-only, Standard Schema `validationSchema`. We
  keep the dependency-free `validate()` function using class-validator /
  class-transformer (already in the project); adding Zod would be a new
  dependency needing separate approval.
- React: installed `^19.2.4`, latest 19.3.0 → bump `react`/`react-dom` to
  ^19.3.0. Finding: `@types/react` / `@types/react-dom` are missing from the
  frontend; add them at ^19.3.0 (dev deps).
- Out of scope (reported, separate spec): frontend Vite 6.2 → 8.3 and
  TypeScript 5.8 → 6/7; backend global Prettier debt.

## Target versions
- Backend: `@nestjs/{common,core,platform-express,testing}` ^12.1.2,
  `@nestjs/cli` ^12.0.8, `@nestjs/schematics` ^12.0.6,
  `@nestjs/config` ^12.0.1, `typescript` ^6.0.3, `engines.node >=20.19.0`.
- Remove unused SDKs: `openai`, `@anthropic-ai/sdk`, `groq-sdk` (only used by
  deleted client-key providers). Reintroduce per provider spec + approval.
- Frontend: `react`/`react-dom` ^19.3.0; add `@types/react`/`@types/react-dom`
  ^19.3.0.
- No new runtime dependencies for env validation.

## Contracts (prompt-agnostic ports; prompts belong to SPEC-004)
```ts
TextGeneratorPort.generate({
  prompt, systemInstruction?, temperature?, maxOutputTokens?, responseJsonSchema?
}) → { text, model, usage? }

ImageGeneratorPort.generate({ prompt, aspectRatio?, imageSize? })
  → { data: Buffer, mimeType, model }

TtsPort.synthesize({ text, voiceName?, languageCode? })
  → { audio: Buffer, mimeType, model }
```
- `AiProviderError { code, message }` wraps SDK failures; never leaks key or
  raw provider payload. Codes: PROVIDER_UNAVAILABLE, INVALID_REQUEST,
  CONTENT_BLOCKED, RATE_LIMITED, TIMEOUT, UNKNOWN.
- DI tokens `TEXT_GENERATOR`, `IMAGE_GENERATOR`, `TTS_GENERATOR` bound by
  `AiModule` according to `AI_PROVIDER` (gemini only for now).
- `SecretProvider { get(name) }` + `EnvSecretProvider` (dev). Production KMS
  and per-tenant keys: SPEC-020.
- TTS generation uses `responseModalities: [AUDIO]` + `speechConfig`
  (`voiceConfig.prebuiltVoiceConfig.voiceName`, `languageCode`); returns raw
  PCM audio + mime type (WAV container is a playback concern, later spec).

## Environment variables (validated at boot)
`GEMINI_API_KEY`, `AI_PROVIDER=gemini`, `AI_MODEL_TEXT=gemini-3.8-flash`,
`AI_MODEL_IMAGE=gemini-3.1-flash-image`, `AI_MODEL_TTS=gemini-3.8-flash-tts`,
`AI_TTS_VOICE=Kore`, `AI_TTS_LANGUAGE=es-419`, `AI_ENDPOINTS_ENABLED=false`
(consumed by SPEC-003), `PORT`, `NODE_ENV`. `.env.example` updated; no real
secrets committed.

## File impact
- New: `src/config/env.validation.ts`; `src/ai/{tokens.ts, ai.errors.ts}`;
  `src/ai/domain/ports/{text-generator,image-generator,tts}.port.ts`;
  `src/ai/infrastructure/gemini/{gemini-client.factory.ts,
  gemini-text.adapter.ts, gemini-image.adapter.ts, gemini-tts.adapter.ts}`;
  `src/ai/secrets/{secret-provider.ts, env-secret.provider.ts}` + specs.
- Rewrite: `src/ai/ai.module.ts`. Touch: `src/app.module.ts`,
  `backend/.env.example`, `backend/package.json`, `backend/tsconfig.json`
  (only if TS 6 requires it).
- Delete: `ai.controller.ts`, `ai.service.ts`, `dto/*`, `providers/*` legacy.
  Keep `guards/ai-endpoints-enabled.guard.ts` + its spec for SPEC-003.
- Frontend: `package.json` only.

## Acceptance criteria
1. `npm run build` and `npm test` green in `backend/`; touched/new files pass
   targeted ESLint/Prettier (no reformat of unrelated debt).
2. Boot fails when `AI_ENDPOINTS_ENABLED=true` and `GEMINI_API_KEY` is
   missing; in dev without key, adapters fail on use with a clear error, not
   at boot.
3. No `apiKey` in DTOs/controllers (grep); key only via `SecretProvider` /
   `ConfigService`, never logged.
4. Adapters map SDK responses (text, image `inlineData`, TTS audio) and wrap
   errors as `AiProviderError` without secrets.
5. Legacy `/ai` POST endpoints and client-key providers no longer exist; the
   guard unit test stays green.
6. Frontend builds on React 19.3 with React type packages installed.
7. Tests mock `@google/genai`: zero real network calls.

## Edge cases
Missing key (dev vs prod), invalid model env value, provider error/timeout,
missing `inlineData`, TTS input over token limit (explicit error; chunking is
SPEC-005/007), es-AR unsupported, unknown `AI_PROVIDER` (factory error).

## Out of scope
Prompts/DTOs/OpenAPI/idempotency (SPEC-003/004), output validation/moderation
(SPEC-005), queue/SSE (SPEC-006/007), KMS/tenant keys (SPEC-020), Vite/TS
frontend majors, global Prettier chore.

## Verification
`cd backend && npm run build && npm test`; targeted `npx eslint` on new files;
grep `apiKey` in DTO/controller; `npm run build` in frontend root.
