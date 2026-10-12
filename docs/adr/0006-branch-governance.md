# 0006 — `dev`/`main` branch governance and squash-only merges

- Status: Accepted
- Date: 2026-10-01 (reconstructed from SPEC-019/024)

## Context

Once the API and frontend changes ship, a convention described only in
`AGENTS.md` is easy to bypass. `main` was unprotected and commit messages were
not validated.

## Decision

- Feature branch from `dev`; PR to `dev`; `main` only updated from `dev` at phase
  close.
- Protect branches with required status checks
  (`frontend`, `frontend-e2e`, `backend`, `commitlint`), linear history, no force
  push/delete; `main` additionally requires 1 review and code-owner review.
- Enforce **Conventional Commits** locally (husky + commitlint) and in CI.
- Enable **squash-only** merges with automatic branch deletion.
- Keep the configuration reproducible via `scripts/github-governance.sh`.

## Consequences

- Positive: a consistent, reviewable history; CI gates every change; governance
  is re-appliable.
- Negative: extra ceremony for small fixes; the admin can bypass `dev` protection
  (`enforce_admins=false`) and must act responsibly.
