# 0002 — NestJS 12 API + Supabase Auth only in the frontend

- Status: Accepted
- Date: 2026-10-01 (reconstructed from SPEC-002/010)

## Context

The product needs a single backend to host AI, validation, jobs and data, while
keeping login simple for teachers. The existing frontend already used Supabase.

## Decision

- Build the backend with **NestJS 12** and **TypeScript** (ESM), exposing
  `/api/v1` with Swagger outside production.
- Keep Supabase for Postgres and **Auth**; the frontend holds only the public
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` for login/refresh.
- Authorize backend requests with the Supabase JWT; scope all data by the
  authenticated teacher.

## Consequences

- Positive: clear module boundaries (`actions`, `profiles`, `books`, `ai`,
  `jobs`), one auth path, typed DTOs with `class-validator`.
- Negative: two runtimes to run locally (frontend `:3000`, backend `:3001`);
  Jest needs `--experimental-vm-modules` for ESM.
