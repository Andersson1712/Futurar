# SPEC-019 — CI: lint/typecheck/test/build and blocked merges

- Status: **implemented** (approved by owner 2026-09-30; decisions D1–D4 as recommended)
- Phase: 5 / EPIC 5.3
- Depends on: SPEC-017/018 (tests + coverage floor)
- Blocks: SPEC-024 (Git flow), release

## Implementation notes
- `.github/workflows/ci.yml` with three jobs: `frontend` (typecheck,
  check:supabase, test:coverage + lcov artifact, build), `frontend-e2e`
  (Playwright Chromium) and `backend` (build, lint, test, test:e2e) using
  Node 24 and npm cache; runs on PRs to `dev`/`main` and pushes to `dev`, with
  per-ref concurrency cancellation.
- Actions pinned to current majors (checkout/setup-node/upload-artifact v7).
- Branch protection for `dev` configured via API: required checks
  `frontend`, `frontend-e2e`, `backend`, no force pushes, no deletions and a
  required pull request (0 approvals) so direct pushes are discouraged;
  `enforce_admins=false` lets the owner bypass in emergencies. `main` stays
  frozen until indicated.
- Frontend ESLint deliberately deferred to its own chore (legacy components);
  the frontend gate is typecheck + check:supabase + tests + build.

## Objective
Add GitHub Actions CI that gates every PR: frontend typecheck, tests with a
non-decreasing coverage floor, build and the Supabase-import check; backend
build, lint, unit and e2e tests; plus the Playwright critical-flow suite. Then
configure branch protection so `dev` cannot be merged into with red checks.

## Current state
- No `.github/workflows` in `dev` (only the legacy `sync-upstream.yml` lives in
  `dev-legacy-backup`).
- Repo is public, owner has admin, `gh` token has `repo` + `workflow` scopes.
- Frontend scripts: `typecheck`, `test`, `test:coverage` (floor 36/35/33/37),
  `test:e2e` (Playwright), `check:supabase`, `build`.
- Backend scripts: `build`, `lint`, `test` (NODE_OPTIONS for ESM), `test:e2e`.

## Decisions to confirm
- **D1 Scope (recommended)**: one workflow with three jobs — `frontend`,
  `frontend-e2e` and `backend` — so backend regressions are gated too.
  Alternative: frontend only (plan minimum).
- **D2 Frontend lint (recommended)**: no new frontend linter yet; the frontend
  gate is `typecheck` + `check:supabase` + tests. Adding ESLint to the legacy
  components would be a large red-first migration (its own chore).
  Alternative: add ESLint now.
- **D3 Branch protection (recommended)**: configure required status checks on
  `dev` (and later `main`) via the GitHub API once the workflow names are
  known, so red checks block merges. Alternative: document it as an owner
  manual action.
- **D4 E2E in CI (recommended)**: a Playwright job installs Chromium and runs
  `test:e2e` (critical flow + scroll). Alternative: keep CI unit/build only.

## Contract
```yaml
# .github/workflows/ci.yml
on:
  pull_request: { branches: [dev, main] }
  push: { branches: [dev] }
concurrency: cancel-in-progress per ref
jobs:
  frontend:        npm ci · typecheck · check:supabase · test:coverage · build
  frontend-e2e:    npm ci · playwright install chromium · test:e2e
  backend:         cd backend · npm ci · build · lint · test · test:e2e
```
- Node 24 (matches local) with `actions/setup-node` cache.
- Coverage enforced by the Vitest thresholds (job fails if it drops); lcov
  uploaded as an artifact.
- Branch protection on `dev`: require the three checks, no force pushes, no
  deletions; `main` stays frozen until the owner indicates.

## File impact
- New: `.github/workflows/ci.yml`.
- Update: `docs/specs/SPEC-019.md`, `plan.md`, `MEMORY.md`, `AGENTS.md`
  (CI note) if needed.
- No app code changes.

## Acceptance criteria
1. The workflow runs on PRs to `dev` and pushes to `dev`; all three jobs are
   green on the current `dev` state.
2. Coverage floor failures fail the `frontend` job.
3. Branch protection on `dev` requires the three checks (verified via the API)
   and blocks force pushes/deletions.
4. A failing check prevents merging (documented behavior; verified by the
   protection settings).
5. Local scripts keep working unchanged.

## Edge cases
Playwright browser cache/download time; `npm ci` with the root lockfile;
backend ESM Jest needing Node ≥24.9 in CI; concurrency cancelling superseded
runs; required check names drifting if jobs are renamed.

## Out of scope
Frontend ESLint migration, release automation (SPEC-026), security scanning,
matrix across browsers/OS.

## Verification
Push the branch and confirm the workflow is green in GitHub Actions; query
`gh api repos/.../branches/dev/protection` to confirm required checks.
