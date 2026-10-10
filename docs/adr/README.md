# Architecture Decision Records (ADRs)

Short records of the decisions that shape Futurar. Reconstructed from
`docs/specs/` and `MEMORY.md`; format is a light [MADR](https://adr.github.io/madr/).

> Last reviewed: 2026-10-01

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-backend-owns-ai-and-data.md) | Backend owns AI and data; the frontend is UI + Auth only | Accepted |
| [0002](0002-nestjs-supabase-auth.md) | NestJS 12 API + Supabase Auth only in the frontend | Accepted |
| [0003](0003-jobs-sse-queue.md) | Async generation jobs with SSE and an `inline|bullmq` queue driver | Accepted |
| [0004](0004-encrypted-credentials.md) | Per-teacher encrypted AI credentials | Accepted |
| [0005](0005-actions-options-catalog.md) | Generic actions/options catalog with per-profile permissions | Accepted |
| [0006](0006-branch-governance.md) | `dev`/`main` branch governance and squash-only merges | Accepted |

To add an ADR: copy the structure of an existing one, use the next number, and
link it here.
