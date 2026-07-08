# Contributing

> How to make a change to Universal Healthcare Data Network that lands cleanly — standards, workflow, PR checklist, and the values we hold the codebase to.

[Back to README](../README.md) · [Architecture](./architecture.md) · [Testing](./testing.md) · [Environment](./environment.md)

---

## Quickstart

```bash
# 1. Install
pnpm install

# 2. Copy env files for the apps you're touching
cp apps/api/.env.example    apps/api/.env
cp apps/web/.env.example    apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

# 3. Push the dev database
pnpm --filter @universal-healthcare/api exec prisma generate
pnpm --filter @universal-healthcare/api exec prisma db push

# 4. Run the relevant app
pnpm dev:api      # http://localhost:4000
pnpm dev:web      # http://localhost:3000
pnpm dev:mobile   # Expo Dev Tools

# 5. Verify before pushing
pnpm check                  # lint + typecheck + test across the workspace
tools/ci-local.sh --quick   # api + web + shared, ~1 min
tools/ci-local.sh           # full CI suite, incl. docker, ~3 min
```

---

## Coding standards

| Standard                      | Where                                                                |
| ----------------------------- | -------------------------------------------------------------------- |
| TypeScript `strict` everywhere | `tsconfig.base.json`                                                |
| ESLint flat config            | `eslint.config.mjs` — `pnpm lint` (or `pnpm lint --filter <pkg>`)    |
| Prettier                      | `.prettierrc.json` — `pnpm format` (write) or `pnpm format:check`    |
| Modular monolith convention   | [Architecture · `apps/api`](./architecture.md#backend--appsapi)       |
| **Shared contracts first**     | If a shape crosses api ↔ web, define it in `@universal-healthcare/shared` |
| Tests for any behaviour change | [Testing](./testing.md)                                             |

If a `pnpm lint` or `pnpm typecheck` warning appears for code you didn't touch, it's almost always a transitive regression — fix the root cause, don't suppress locally.

---

## Development workflow

1. **Branch off `main`.** Keep branches focused (`fix/auth-token-expiry`, `feat/fan-router`, never `misc-stuff`).
2. **Run `pnpm install`** if `pnpm-lock.yaml` changed or you switched branches.
3. **Copy env files** ([Environment](./environment.md)) for the apps you'll exercise.
4. **Make scoped changes.** Extend an existing module / package rather than creating a new top-level layer unless the new layer is justified.
5. **The pre-push hook runs `tools/ci-local.sh --quick --no-docker` automatically** on every `git push` — you don't need to remember to run it. The hook is installed by `lefthook` (auto-installed by `pnpm install` via the `prepare` script), configured in `lefthook.yml`, and runs sequentially: the Git LFS check first (preserves the legacy behavior the repo had), then the local CI suite (api + web + shared, ~1 min on a warm cache). If the hook blocks your push, run `tools/ci-local.sh --quick` locally to see the failure, fix it, and re-push. For a full pre-push check including docker, use `tools/ci-local.sh` with no flag (~3 min) — the hook skips docker so it stays fast. **Bypass for emergencies only:** `git push --no-verify`.
6. **Open a PR against `main`.** Target branch is `main`. PRs auto-trigger the workflow(s) for the packages you touched and any package that depends on them.

---

## Pre-push hook

A `lefthook`-managed `pre-push` git hook is installed automatically when you run `pnpm install` (the root `package.json` `prepare` script calls `lefthook install`). The config lives in `lefthook.yml` at the repo root.

What it does, in order:

1. **Git LFS check** — preserves the legacy `.git/hooks/pre-push` behavior. The repo doesn't currently use LFS (no `.gitattributes` with `* filter=lfs`), but the check is preserved so a future LFS filter doesn't silently fail. Errors with exit code 2 if `git-lfs` is not on your `PATH`.
2. **Local CI suite** — runs `tools/ci-local.sh --quick --no-docker`. Mirrors the GitHub Actions workflows for the most-touched packages (api + web + shared). ~1 min on a warm cache. Skips the docker build (step 7) so the hook stays fast enough to run on every push.

If the hook blocks your push, the output names which step failed — run that step's command manually to see the details, fix the underlying issue, and re-push.

**Bypass for emergencies only:** `git push --no-verify`. Use this when you have a specific, documented reason (e.g., a broken main that you need to push a hotfix past). The hook re-fires on the next push unless the underlying issue is fixed.

---

## PR checklist

A PR is review-ready when every box here is true:

- [ ] **Scoped** — one logical change, named clearly in the title and PR body
- [ ] **Tests** — `vitest` / `jest` coverage for any new or changed behaviour
- [ ] **Pre-push hook passed** — `git push` ran the lefthook-managed pre-push hook (LFS check + `tools/ci-local.sh --quick --no-docker`) and reported green; bypassed via `git push --no-verify` only if you have a documented reason
- [ ] **Shared schemas** — any cross-app shape lives in `@universal-healthcare/shared`
- [ ] **No new `.env`** — only `.env.example` updates are committed
- [ ] **No generated artefacts** — `dist/`, `.next/`, `.expo/`, `*.db` are gitignored
- [ ] **Docs** — README or `docs/*` updated if behaviour or commands changed
- [ ] **No surprise deps** — `pnpm add <pkg>` not a hand-edited `package.json`

---

## What we optimise for

- **One source of truth.** Shapes live in `@universal-healthcare/shared`. Auth lives in one module. Errors live in one type.
- **Fail loudly, fail early.** Schema drift, typing mismatches, and bad input are caught at the compiler, the test, or the request boundary — never after deploy.
- **Small, reviewable PRs.** A PR that touches one module and one test is better than one that touches six.
- **Tests near the code.** Module tests live in `src/modules/<domain>/tests/`, not in a separate `__tests__/` tree.
- **A monotonically healthier codebase.** New commits should leave the lint, type, and test posture better than they found it.

---

## Contribution expectations

- Be specific in PR descriptions — *what* changed, *why*, and *how you verified*. Bullet the verification (`pnpm test`, `pnpm typecheck`, manual URL hit).
- Don't commit secrets, `.env` files, or generated artifacts. `.env.example` may grow; `.env` never does.
- Prefer extending the existing module / package structure over introducing new top-level layers. If you're sure you need a new layer, write that up in the PR description.
- Avoid drive-by refactors. Refactors that span multiple modules belong in their own PR with their own description.

---

## Common pitfalls

| Symptom                                                | Almost-always-the-cause                              |
| ------------------------------------------------------ | ---------------------------------------------------- |
| Web app can't find `@universal-healthcare/shared`      | Missing `transpilePackages` in `next.config.mjs`     |
| `vitest: not found` in a sub-subpackage               | That subpackage never ran `pnpm install`; re-run at workspace root |
| `prisma generate` drift after schema change            | Run it: `pnpm --filter @universal-healthcare/api exec prisma generate` |
| ESLint flat config warnings                           | Run `pnpm format` before chasing them by hand       |
| `pnpm-lock.yaml` out of sync with team                 | Always commit the lockfile; never edit it by hand    |
| Install / lockfile or docker build fails locally but CI is green | Run `tools/ci-local.sh --no-docker` to isolate the install / turbo / docs layers from the docker layer; if the failure is docker-specific, run `tools/ci-local.sh` (no flag) to include the docker build step |

---

## Where to ask for help

- Open an issue with the `question` label for clarification or design feedback.
- Open a draft PR early for any non-trivial change. Reviewers prefer to see direction before you finish.
- For security disclosures, see [Security](./security.md) (or `SECURITY.md` — whichever ships first).

Thanks for building this with us.
