# Architecture Decision Records

> Why we did what we did — short records that capture a decision's *context*, the choice we made, and the *consequences* (good and bad). Future contributors should be able to read these to understand the shape of the codebase, not just re-discover it.

[Back to README](../../README.md) · [Architecture](../architecture.md) · [Security](../security.md) · [Contributing](../contributing.md)

---

## What these are

Each ADR is a short Markdown file with five fixed sections:

1. **Status** — `Proposed` · `Accepted` · `Deprecated` · `Superseded by NNNN`
2. **Context** — the situation at the time of the decision. What forces were at play? What was uncertain?
3. **Decision** — what we chose, in one short paragraph.
4. **Consequences** — the *positive* outcomes we gained followed by the *negative* outcomes we accepted (with mitigations when we have them).
5. **References** — links back to the code or docs that implement the decision.

We follow the [Michael Nygard ADR template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) conventions:

- One decision per file
- Files are numbered sequentially and never reordered (`NNNN-kebab-case-title.md`)
- Past decisions are **immutable** — if we change our mind, we *supersede* the old ADR rather than editing it
- Status changes append a dated entry; prose itself is preserved

---

## Index

| #   | Title                                                  | Status   | Date       |
| --- | ------------------------------------------------------ | -------- | ---------- |
| [0001](0001-modular-monolith.md)                          | Modular monolith for the API                            | Accepted | 2026-Q3    |
| [0002](0002-sqlite-dev-postgres-prod.md)                  | SQLite in dev / Postgres in prod (Prisma datasource)    | Accepted | 2026-Q3    |
| [0003](0003-shared-package-from-source.md)                | `@universal-healthcare/shared` consumed from TypeScript source, no build | Accepted | 2026-Q3    |

> **Adding a new ADR?** Don't edit this index by hand — append a new file and a row, then open a PR. CI will verify the index links resolve.

---

## How to write a good one

- **Keep it short.** If it takes more than 200 lines, the decision was probably too vague. Split or sharpen.
- **Don't editorialize the past.** Record *why the choice was rational at the time*, not whether it was a mistake.
- **List both positive AND negative consequences.** A decision without costs is a sales pitch, not an ADR.
- **Cite code.** If you say "we use bcrypt", link to `auth.service.ts` so the reader can verify.
- **Date the status, not the prose.** Superseded → make new ADR; Reversed → make new ADR; Deprecation → status line only.

When the codebase grows, this folder should be the *first* thing you read on day one. If it isn't, we wrote the wrong ones.
