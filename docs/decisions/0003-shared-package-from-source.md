# 0003 — `@universal-healthcare/shared` consumed from TypeScript source

- **Status**: Accepted
- **Date**: 2026-Q3

---

## Context

A workspace package exports Zod schemas and typed DTOs that every consumer in the monorepo (and *only* the monorepo) uses:

- `apps/api` validates request bodies and shapes responses against it.
- `apps/web` uses the same Zod schemas for client-side form validation.
- (Eventually) `apps/mobile` will do the same.

We had three options for implementing the share:

- **Pre-built JS package.** The shared package builds to `dist/`; consumers import from there. Standard for publishing to npm.
- **Source-only with a build step.** The shared package builds, but consumers in the same monorepo import from source.
- **Source-only, no build step.** The shared package's `main` and `types` both point at `src/index.ts`; consumers import source directly via the workspace link.

Constraints at the time:

- Schema drift between client and server is a **correctness bug**, not a maintenance chore — we want loud failures.
- We are not (yet) publishing the shared package to npm; consumption is *internal only*.
- Next.js bundling and Vitest both need to be able to resolve TypeScript directly.
- pnpm workspace symlinks a `node_modules/@universal-healthcare/shared` to the package directory — by default that resolves through the `main` field.

---

## Decision

We adopt **source-only, no build step**:

- `packages/shared/package.json` declares `"main": "./src/index.ts"` and `"types": "./src/index.ts"` (no `build` step in the package scripts that compiles to `dist/`).
- Both `apps/api` and `apps/web` consume the package via the pnpm workspace link — and because the `main` points at source, they import the `.ts` directly.
- `next.config.mjs` in `apps/web` opts the package into Next's transpilation pipeline: `transpilePackages: ["@universal-healthcare/shared"]`.
- Vitest configs in api/web alias `@universal-healthcare/shared` to its source file so the test runner can resolve it without a build: `path.resolve(dirname, "../../packages/shared/src/index.ts")`.
- `packages/shared`'s TypeScript config uses `NodeNext` module + moduleResolution with `.js` extension imports — these are *compile-time only* and don't appear at runtime.

---

## Consequences

### Positive

- **One source of truth.** The `.ts` file in `packages/shared/src/` is what every consumer compiles against. No "I forgot to rebuild" / "I forgot to publish" failure mode.
- **Schema drift is loud.** A breaking change to a schema fails `pnpm typecheck` for every consumer in the same Turbo run. Drift across client and server becomes impossible to miss.
- **Faster iteration.** No `pnpm --filter @universal-healthcare/shared build` step in the dev loop — edit, save, the consumers see it.
- **CI cascades for free.** A change to `shared` triggers `api`, `web`, and (eventually) `mobile` test runs through Turbo's task graph. Reviewers see the full impact.
- **Reduced package surface.** There's no `dist/` to clean, no `tsconfig.build.json` to maintain.

### Negative

- **Consumption is deployment-coupled.** We can't publish `@universal-healthcare/shared` to npm as a stable artefact without first re-introducing a build step. If/when we want to publish, there's a real piece of work to do.
- **TypeScript module mode has teeth.** `NodeNext` is the right choice, but it forces `.js` extension imports in shared package source — slightly less ergonomic for newcomers. Breaking the convention fails the consumers' typecheck.
- **Next.js needs explicit opt-in.** Without `transpilePackages`, Next.js fails to load the package (or worse, fails silently in production builds). We've documented the requirement but not enforced it via tests.
- **Vitest needs an explicit alias** for the package (we have one in `vitest.config.ts` per consumer). Without it, the test runner tries to resolve `@universal-healthcare/shared` against node_modules and fails.
- **Bundle-leak risk.** If someone later adds *runtime* code to `@universal-healthcare/shared` (e.g. a server-only helper that's accidentally imported by the web client), it ends up bundled into the client. Zod schemas are fine; non-pure code is not.

### Mitigations

- `transpilePackages` is set in `next.config.mjs` and noted in [`docs/architecture.md`](../architecture.md). A small grep-based check in CI for `next.config.mjs` would catch regression.
- `vitest.config.ts` aliases in both `apps/api` and `apps/web` keep tests in lockstep — they can't drift unless one is edited independently.
- The shared package's exports are *intentionally* Zod schemas + types + small pure utilities (the existing `profileCompleteness` helper). Anything impure belongs in a package that's clearly marked client-only or server-only.
- If/when we publish: add a build step (`tsc -p tsconfig.build.json`) **without** changing the consumer story. Workspace consumers still import from source; the `dist/` is only for npm distribution.

---

## References

- [`packages/shared/package.json`](../../packages/shared/package.json) — `main: "./src/index.ts"`, `types: "./src/index.ts"`
- [`packages/shared/tsconfig.json`](../../packages/shared/tsconfig.json) — `NodeNext` module / moduleResolution
- [`apps/web/next.config.mjs`](../../apps/web/next.config.mjs) — `transpilePackages: ["@universal-healthcare/shared"]`
- [`apps/api/vitest.config.ts`](../../apps/api/vitest.config.ts) and [`apps/web/vitest.config.ts`](../../apps/web/vitest.config.ts) — Vitest alias to source
- [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts) — the actual contract surfaces
