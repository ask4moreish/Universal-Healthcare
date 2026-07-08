<!--
Thanks for contributing to Universal Healthcare Data Network! 🎉

This template is auto-loaded into every new PR. The checklist below mirrors
the canonical "PR checklist" in docs/contributing.md — please leave it
in sync if you add or remove a requirement there.

Full guide: ../docs/contributing.md
-->

## What

<!-- One short paragraph: what does this PR change? -->

## Why

<!-- One short paragraph: what problem does it solve, and how? Link any
     related issue with `Closes #NNN` or `Refs #NNN`. -->

## How verified

<!-- Bullet the verification you ran. Examples:
     - `tools/ci-local.sh --quick` — clean locally
     - `pnpm --filter @universal-healthcare/api test` — new + existing tests pass
     - Manual: `curl http://localhost:4000/api/creators` returns the new shape
     - Screenshots / recordings for any UI change
-->

## Linked issues

<!-- `Closes #123` · `Refs #456` · `Blocked by #789` (one per line, or leave blank) -->

## Breaking changes

<!-- If this PR changes a public API, env-var contract, or shared schema in
     @universal-healthcare/shared, call it out here. Reviewers will look for
     a migration note + a CHANGELOG.md entry. Otherwise write "None". -->

## PR checklist

<!-- The canonical list lives in docs/contributing.md. Keep this in sync. -->

- [ ] **Scoped** — one logical change, named clearly in the title and PR body
- [ ] **Tests** — `vitest` / `jest` coverage for any new or changed behaviour
- [ ] **`tools/ci-local.sh --quick`** — clean locally for affected packages (or `pnpm check` for faster iterative feedback)
- [ ] **Shared schemas** — any cross-app shape lives in `@universal-healthcare/shared`
- [ ] **No new `.env`** — only `.env.example` updates are committed
- [ ] **No generated artefacts** — `dist/`, `.next/`, `.expo/`, `*.db` are gitignored
- [ ] **Docs** — README or `docs/*` updated if behaviour or commands changed
- [ ] **No surprise deps** — `pnpm add <pkg>` not a hand-edited `package.json`
