# 0001 — Modular monolith for the API

- **Status**: Accepted
- **Date**: 2026-Q3 (initial adoption)

---

## Context

We needed a backend for Universal Healthcare Data Network. The candidate architectures were:

- **Distributed microservices**, one Express (or alternative) service per domain.
- **Single deployable monolith**, organised however we liked.
- **Modular monolith** (monolith with enforced module boundaries).

Constraints at the time:

- Small team — every deploy is operational cost, every service is more surface to test and observe.
- Greenfield — we don't know which domains will become heavy enough to warrant extraction.
- Contracts must be shared with the web and mobile clients, both of which sit in the same monorepo and consume from `@universal-healthcare/shared`.
- Heavy uncertainty around the eventual *real* domain boundaries (creators, fans, payments, ledger, etc.).
- The monorepo is turbo-orchestrated anyway, so per-package CI was already going to be cheap.

---

## Decision

We use a **single Express process** containing **modular boundaries** enforced by convention:

- Every domain lives in its own folder under `apps/api/src/modules/<domain>/` with a consistent inner shape (`controllers`, `services`, `repositories` *only when owned*, `validators`, `routes`, `types`, `tests`).
- Cross-module access goes through **services**, never **repositories** — the `users` service is the only one anyone imports a row from.
- `createApp()` from `apps/api/src/app.ts` is the unit of testability — both Supertest-based integration tests and any future per-module process extraction live behind the same entry point.
- Bootstrap is a single `pnpm dev:api` call.

---

## Consequences

### Positive

- **One deploy unit.** One CI job, one host, one port, one healthcheck.
- **Refactors are cheap.** Splitting a method across `users` and `creators` is two file edits and a Turbo cache hit; no service-mesh decisions, no new IAM roles, no new env contracts.
- **Single source of truth for types.** `@universal-healthcare/shared` types are imported freely across modules — there is *one* `User`, *one* `CreatorProfile`, *one* `FanProfile`.
- **Tests are easy to write.** `request(app)` against `createApp()` gives full middleware / route integration without port allocation or service discovery.
- **Turbo's dependency graph already cascades** — a change to `packages/shared` triggers the api test run automatically.

### Negative

- **Boundaries are convention, not enforcement.** A module can reach across into another module's `repository/` if a developer is careless — there is no NestJS / DI container to refuse.
- **Single point of failure.** One crash takes the whole API down. Module X's latency spike is module Y's latency spike.
- **Scaling shape is vertical.** When one module becomes 10× heavier than the others, the answer is "buy a bigger box" until we explicitly split it out (see *Mitigation*).
- **Extraction is real work, not a rename.** When `fans` becomes its own product line, copying the folder into a new service is a real architectural decision, not a button.
- **Cross-module DI / shared state between calls is easy to write by accident** without a service container to discourage it.

### Mitigations

- Each module has its own `tests/` folder; integration is asserted at the router boundary.
- The "no cross-module repository access" rule is documented in [`docs/architecture.md`](../architecture.md) and is the first thing a reviewer looks at when adding a new module.
- When the time comes to extract `fans` (or whatever is hot), `@universal-healthcare/shared` already gives us a typed wire boundary — we don't have to invent one.

---

## References

- [`docs/architecture.md`](../architecture.md) — module convention, current modules table, how to extend
- [`apps/api/src/app.ts`](../../apps/api/src/app.ts) — router mounting
- [`apps/api/src/modules/auth/services/auth.service.ts`](../../apps/api/src/modules/auth/services/auth.service.ts) example of cross-module service import (`userService`)
