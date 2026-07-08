# 0002 — SQLite in dev, Postgres in prod (Prisma datasource)

- **Status**: Accepted
- **Date**: 2026-Q3

---

## Context

Prisma supports multiple database engines; each has different operational shapes. We needed to choose a default for local development and a target for production.

Candidate choices:

- **Postgres everywhere**, local + production.
- **SQLite everywhere**, including production.
- **SQLite in dev / Postgres in prod**, with the schema kept portable.

Constraints at the time:

- Local dev must work on a fresh laptop with **no Docker, no Postgres daemon, no extra services** — `pnpm install && pnpm dev:api` should just work.
- Tests need an **isolated** database that can be cleared between runs and doesn't share state with anything else.
- The schema was small (3–4 models at the time, more later) and doesn't use exotic SQL features.
- Production needed Postgres-class features (concurrency, replication, point-in-time recovery) eventually — but not on day one.
- We wanted to be able to validate schema changes against a real Postgres before they shipped, but didn't want every developer running one locally.

---

## Decision

We adopt a **two-mode datasource** strategy with a **portable schema**:

- **Default `provider = "sqlite"`** in `apps/api/prisma/schema.prisma`. Local dev uses `DATABASE_URL=file:./dev.db`.
- **Tests** use a separate sqlite file configured via `apps/api/.env.test`. The `test` script runs `prisma db push` against that file before Vitest, and the global `beforeEach` in `tests/setup.ts` clears tables between tests.
- **Production** swaps to Postgres by changing `DATABASE_URL` to a Postgres connection string *and* updating the schema's datasource provider — both during a deploy.
- The Prisma schema uses **only portable types and clauses** — no `JSONB`, no SQLite-only `INTEGER PRIMARY KEY AUTOINCREMENT` patterns (we use `@default(cuid())`), no ARRAY columns. Whatever Prisma generates for sqlite must generate for Postgres unchanged.

---

## Consequences

### Positive

- **Zero-friction onboarding.** `pnpm install && pnpm dev:api` works on a clean laptop with Node and pnpm — nothing else.
- **Fast deterministic tests.** File-based SQLite tests run in milliseconds and are easy to tear down. The `fileParallelism: false` setting sidesteps any lock contention.
- **Same migrations across environments.** One schema; `prisma migrate` knows how to deal with both engines.
- **Postgres-ready production.** When we're ready, we just swap the provider and the URL.

### Negative

- **SQLite ≠ Postgres.** Features that work in one may silently fail in the other. We accept this *now* because the schema doesn't use any of them.
- **Write concurrency is serialised** by SQLite. Tests already mitigate with `fileParallelism: false`. Real production concurrency is a Postgres-only feature — until we cut over, every write in dev goes through the file lock.
- **One-off Postgres verification is still needed.** Schema changes must be checked against a real Postgres somewhere (CI step, manual docker). A schema that generates on sqlite can still fail on Postgres.
- **Production cutover is real work.** It requires (a) a production Postgres, (b) `prisma migrate diff` between sqlite and the target PG tables, (c) data backfill if any rows need to move.

### Mitigations

- Schema uses only portable Prisma primitives. We grep sqlite-specific and PG-specific operators as part of the lint posture (planned follow-up).
- CI must run `prisma migrate diff` against Postgres on every schema PR — *not* against sqlite — to catch drift. Until that's wired, every schema PR needs a reviewer to manually verify on a local PG.
- The `prisma db push` shortcut stays for dev and tests only. Production migrations are applied with `prisma migrate deploy`.

---

## References

- [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma) — portable schema, currently `provider = "sqlite"`
- [`apps/api/src/shared/config/env.ts`](../../apps/api/src/shared/config/env.ts) — `DATABASE_URL` is required and validated by zod
- [`apps/api/.env.example`](../../apps/api/.env.example) and [`apps/api/.env.test`](../../apps/api/.env.test) — default/test connection strings
- [`docs/environment.md`](../environment.md) — `DATABASE_URL` and the dev/prod swap story
