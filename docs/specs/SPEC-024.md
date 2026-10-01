# SPEC-024 — Repository governance: protected branches, commit linting and contribution templates

- Status: **implemented** (2026-10-01; branch protection applied to `main`/`dev`)
- Phase: 7 / EPIC 7.1
- Depends on: SPEC-019 (CI + protected `dev`)
- Blocks: SPEC-025 (public docs), SPEC-026 (release), release/public launch

## Objective
Close the governance gap left by SPEC-019: `dev` is protected and CI runs, but
`main` is unprotected, commit messages are unvalidated, and there are no PR/issue
templates beyond a partial `CODEOWNERS`. This spec makes the git flow enforceable
and reproducible (squash-only, linear history, required checks/review) instead of
a convention described only in `AGENTS.md`.

## Current state
- `origin` = `https://github.com/Andersson1712/Futurar.git`; `gh` authenticated
  as `Andersson1712` with **admin** permission (can apply settings).
- `dev` protection: strict checks `[frontend, frontend-e2e, backend]`, 0 required
  reviews, no force push, no deletions, **linear history disabled**.
- `main`: **not protected** (404).
- Repo merge settings: `allow_squash_merge=true`, `allow_merge_commit=true`,
  `allow_rebase_merge=true`, `delete_branch_on_merge=false`, default `main`.
- No `husky`, no `commitlint`, no `.husky/`, no PR template, no issue templates.
- `CODEOWNERS` exists (default + high-risk paths) but not on `dev` and does not
  cover `.github/`, governance files or `backend/src/{actions,profiles}`.

## Decisions to confirm
- **D1 Commit linting (recommended)**: add root devDependencies
  `husky@^9.1.7`, `@commitlint/cli@^21.2.2`,
  `@commitlint/config-conventional@^21.2.2` (validated with Context7; versions as
  of 2026-10). Root `package.json` gets `"prepare": "husky"`.
  `.husky/commit-msg` runs `npx --no -- commitlint --edit "$1"` (husky v9 native
  `$1`). Config `commitlint.config.js` (ESM, root is `"type": "module"`):
  `export default { extends: ['@commitlint/config-conventional'] };`.
  Alternative: CI-only linting (no local hook, no `prepare` risk).
- **D2 CI job (recommended)**: new `commitlint` job in `.github/workflows/ci.yml`
  that lints the PR commit range
  (`--from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }}`)
  and, on `push` to `dev`, the pushed range. It becomes a required check.
  Alternative: lint only the PR title (weaker).
- **D3 Protection (recommended, applied via script)**: a reviewed, idempotent
  `scripts/github-governance.sh` (uses `gh api`, owner runs it) that sets:
  - `main`: required checks `[frontend, frontend-e2e, backend, commitlint]`,
    1 approving review, dismiss stale reviews, require code-owner review,
    enforce admins, linear history, no force push, no deletions, require
    conversation resolution.
  - `dev`: adds `commitlint` to required checks and enables linear history.
  - repo: `allow_squash_merge=true`, `allow_merge_commit=false`,
    `allow_rebase_merge=false`, `delete_branch_on_merge=true`,
    `squash_merge_commit_title=PR_TITLE`,
    `squash_merge_commit_message=COMMIT_MESSAGES`.
  Alternative: do it by hand in the GitHub UI (not reproducible/reviewable).
- **D4 Templates (recommended)**: `.github/pull_request_template.md` (SPEC link,
  objective, a11y checklist — one-switch, 44px, contrast, focus, no scroll block
  — tests/verification evidence, no-AI-in-frontend confirmation) and
  `.github/ISSUE_TEMPLATE/{bug_report.yml,feature_request.yml,config.yml}`.
- **D5 CODEOWNERS (recommended)**: extend the existing file with `.github/`,
  `CODEOWNERS`, `commitlint.config.js`, `.husky/`, `scripts/check-supabase-imports.mjs`
  and `backend/src/{actions,profiles}/`; commit it to `dev`.
- **D6 Scope**: governance only. Release automation/versioning (SPEC-026) and
  public docs (SPEC-025) stay out. No application code changes.

## Contracts
- `package.json` (root): `scripts.prepare = "husky"`, devDeps above.
- `.husky/commit-msg` (no shebang, husky v9):
  ```
  npx --no -- commitlint --edit "$1"
  ```
- `commitlint.config.js`: `export default { extends: ['@commitlint/config-conventional'] };`
- `.github/workflows/ci.yml`: `commitlint` job, Node 24, `npm ci`, runs the CLI
  with the PR/push range; exits non-zero on a non-conventional message.
- `scripts/github-governance.sh`: bash, `set -euo pipefail`, guards on
  `gh`/network, GET-then-PUT/PATCH via `gh api`, prints resulting state.

## File impact
- New: `commitlint.config.js`, `.husky/commit-msg`,
  `.github/pull_request_template.md`,
  `.github/ISSUE_TEMPLATE/{bug_report.yml,feature_request.yml,config.yml}`,
  `scripts/github-governance.sh`, `docs/specs/SPEC-024.md`.
- Update: `package.json` + `package-lock.json`, `.github/workflows/ci.yml`,
  `CODEOWNERS`, `plan.md` (EPIC 7.1), `MEMORY.md`.

## Acceptance criteria
1. `git commit -m "foo: bar"` is rejected locally (husky) and by the CI
   `commitlint` job; a valid `feat(scope): …` passes.
2. `main` is protected (PR + 1 review + required checks + linear history + no
   force push/no delete); `dev` also requires `commitlint` and linear history.
3. Only squash merge is enabled; branches auto-delete on merge.
4. PR template and the three issue templates render on GitHub; `CODEOWNERS`
   covers the high-risk paths and is present on `dev`.
5. `npm ci` + all CI jobs stay green (husky `prepare` safe in CI).

## Edge cases
Merge/revert commits inside a PR range; squashed PR title must be conventional;
Dependabot/renovate messages (once enabled) may need `commitlint` ignore rules;
`HUSKY=0` in constrained environments; `prepare` failing when `.git` is absent
(e.g. published tarball) — husky v9 no-ops gracefully; admin bypass must stay
disabled (`enforce_admins=true`); re-running the script is idempotent; the
`dev` backup branch `dev-legacy-backup` is left untouched; unprotecting a branch
requires explicit owner action.

## Out of scope
semantic-release/changesets and versioning (SPEC-026), LICENSE (SPEC-026),
README/CONTRIBUTING/ADRs (SPEC-025), CODEOWNERS-based branch protection for
`dev-legacy-backup`.

## Verification
- `npx --no -- commitlint --edit <file>` with a valid and an invalid message.
- `bash scripts/github-governance.sh` then
  `gh api repos/Andersson1712/Futurar/branches/main/protection` and
  `.../dev/protection` show the expected checks/history settings; repo settings
  show squash-only.
- CI: `commitlint`, `frontend`, `frontend-e2e`, `backend` green on a test PR.
- Local: `npm ci` succeeds (husky prepare), `npm run test`, `npm run build`.

## Implementation notes (2026-10-01)
- Dependencies (root devDeps): `husky@9.1.7`, `@commitlint/cli@21.2.2`,
  `@commitlint/config-conventional@21.2.2`; `scripts.prepare = "husky"`; ESM
  `commitlint.config.js` extending config-conventional; `.husky/commit-msg`
  runs `npx --no -- commitlint --edit "$1"` (husky v9; `core.hooksPath` set to
  `.husky/_`, which is gitignored).
- CI: new `commitlint` job (fetch-depth 0, `npm ci`, lints the PR/push commit
  range with a zero-SHA guard) added as a required check.
- Governance: `scripts/github-governance.sh` (idempotent `gh api`) applied to
  `Andersson1712/Futurar` — squash-only + auto-delete branches; `main` protected
  (checks `frontend, frontend-e2e, backend, commitlint`, 1 approving review,
  code-owner review, dismiss stale, enforce admins, linear history, no force
  push/delete, conversation resolution); `dev` gets `commitlint` + linear
  history.
- Templates: PR template (SPEC link, a11y + engineering checklists, verification,
  risk/rollback) and `bug_report.yml`, `feature_request.yml`, `config.yml`
  (blank issues disabled). `CODEOWNERS` extended to `.github/`, `.husky/`,
  `commitlint.config.js`, `scripts/*` and `backend/src/{actions,profiles}`.
- Verification: `commitlint` rejects `foo: bar` and accepts
  `feat(actions): add per-page limits`; YAML of CI + templates parses; GET
  protection reports the expected checks/linear/review values; `npm run test`
  green.
- Deviations: none functional. Applied as owner from a feature branch; the
  settings live on GitHub (not testable by CI), so the script is the source of
  truth for re-applying. Per AGENTS the change lands via PR to `dev`.
