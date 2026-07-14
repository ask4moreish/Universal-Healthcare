# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Feature milestone: three new modules + cross-service notification
emission.

### Added

- **Comments module** (full vertical slice across `packages/shared` and
  `apps/api`). Threaded at one level (parent → `replies[]`); cascade on
  User, Playlist, and parent self-relation; `@@index([playlistId,
createdAt])` for the inbox query. `commentService.getById` returns
  404 (not 403) when the parent playlist is private — same rationale
  as `playlistService.getPublicById` (don't leak which comments
  exist). New endpoints: `GET /api/comments/playlists/:playlistId`
  (public), `POST /api/comments/playlists/:playlistId` (auth),
  `GET /api/comments/:id` (public), `PATCH /api/comments/:id` (auth,
  owner), `DELETE /api/comments/:id` (auth, owner, 204).
- **Follows module** (user-to-user one-way). `@@unique([followerId,
followeeId])` + `@@index([followeeId])`. Self-follow rejected with
  400 `CANNOT_FOLLOW_SELF` at the service layer (Zod has no
  `currentUserId`). Duplicate-follow race caught by Prisma's P2002
  and mapped to 409 `ALREADY_FOLLOWING` — mirrors `auth.service.ts`
  `EMAIL_ALREADY_REGISTERED` pattern. New endpoints:
  `POST /api/follows/me/following/:followeeId`,
  `DELETE /api/follows/me/following/:followeeId` (204),
  `GET /api/follows/me/following` + `/me/followers` (auth),
  `GET /api/follows/users/:userId/following` +
  `/users/:userId/followers` (public, 404-not-leak on missing
  target).
- **Notifications module**. `type` column is `String` +
  `z.enum(['follow', 'comment_reply'])` — no native Postgres ENUM
  (per `docs/decisions/0002-sqlite-dev-postgres-prod.md`).
  `entityType` / `entityId` provide polymorphic linking without a
  separate join table. Asymmetric delete semantics: `recipient:
Cascade` (orphaned notifications have no audience) + `actor:
SetNull` (deleted-actor contributions survive with `actorId:
null`); the prisma schema comment documents both with a SQLite
  `PRAGMA foreign_keys = ON` caveat. `markAllRead` uses
  `prisma.notification.updateMany` (single atomic UPDATE). New
  endpoints: `GET /api/notifications` (auth, paginated),
  `PATCH /api/notifications/:id/read` (auth, owner),
  `POST /api/notifications/read-all` (auth), `DELETE
/api/notifications/:id` (auth, owner, 204).
- **Cross-service notification emission**. `followService.create`
  emits a `'follow'` notification to the followee on success;
  `commentService.create` emits a `'comment_reply'` notification to
  the parent comment's author when the reply is from a different
  user. Both side-effects are sequential, NOT a cross-service
  `$transaction`, and wrapped in `try { ... } catch (err) { void err }`
  so a notification failure does NOT roll back the main operation.
  Mirrors the `auth.service.register` →
  `emailVerificationService.issueAndSend` pattern.- **Web + mobile clients for Comments, Follows, Notifications**. New
  files: `apps/web/lib/comment-client.ts`,
  `apps/web/lib/follow-client.ts`,
  `apps/web/lib/notification-client.ts` — function-per-endpoint
  wrappers mirroring `apps/web/lib/user-client.ts` (token-first
  signature, `apiFetch` + `authHeaders` from `./api-client`).
  Public reads (comments, follows) accept a nullable token so
  anonymous browsing Just Works; auth-gated reads and all writes
  require `token: string`. Mobile side:
  `apps/mobile/src/hooks/useComments.ts`,
  `apps/mobile/src/hooks/useFollows.ts`,
  `apps/mobile/src/hooks/useNotifications.ts` — each module exports
  a read hook (`useXxx()` / `useXxxForPlaylist(playlistId)` /
  `useXxx(userId, scope)`) returning `{ data, pagination, loading,
error, refresh }`, and a sibling actions hook
  (`useXxxActions()`) returning the auth-required mutations.
  Hooks read the token from `useAuth()` and surface `ApiError`
  messages to the `error` state; callers are expected to invoke
  `refresh()` after mutations (no internal cross-hook state
  coupling — keeps the data layer orthogonal).
- **Search module** (cross-entity full-text across creators +
  public playlists + comments on public playlists). Public
  endpoint `GET /api/search?q=…&page=&pageSize=&types=creator,playlist,comment&limit=`
  — no `requireAuth` gate; privacy is enforced in the repository
  layer via `isPublic: true` (playlists) and
  `playlist: { isPublic: true }` (comments). Query parsing: split
  on whitespace, AND each token against the entity's searchable
  fields with Prisma's `contains: token`. Case sensitivity
  follows the underlying DB: **case-INsensitive on SQLite**
  (LIKE is case-insensitive for ASCII by default) and
  **case-sensitive on Postgres** (LIKE without `mode: 'insensitive'`).
  Prisma's `mode: 'insensitive'` is unsupported on SQLite in the
  current project Prisma version, so we accept this cross-DB
  inconsistency as a v1 limitation; v2 will normalize via raw
  SQL `LOWER(col) LIKE LOWER(?)` or a Prisma version upgrade.
  Scoring is JS-side and deterministic: `+10` exact match on
  `displayName`/`title`/`body`, `+5` prefix, `+1` substring,
  plus `+1` per token for `bio` matches (creators). Hits are
  sorted by `score desc, createdAt desc`, then sliced to the
  requested page. Response is a flat
  `{ data: SearchHitResponse[], pagination }` envelope where each
  hit carries a `type: 'creator' | 'playlist' | 'comment'`
  discriminator (discriminated union in shared types) so web /
  mobile clients can `switch (hit.type)` with strict typing. New
  files: `packages/shared/src/types/search.ts`,
  `packages/shared/src/validation/search.ts`,
  `apps/api/src/modules/search/{services,controllers,routes,types,tests,index}.ts`,
  `apps/web/lib/search-client.ts`,
  `apps/mobile/src/hooks/useSearch.ts`. Repository additions:
  `creatorRepository.search` + `countSearch`,
  `playlistRepository.searchPublic` + `countPublicSearch`,
  `commentRepository.searchPublic` + `countPublicSearch`.

### Changed

- **`apps/api/tests/setup.ts`** — added `prisma.comment.deleteMany()`,
  `prisma.follow.deleteMany()`, and `prisma.notification.deleteMany()`
  to the top of `beforeEach` so the new tables are wiped before any
  token or profile deletes. SQLite FK race safety even with
  `onDelete: Cascade`.

## [0.2.0] - 2026-07-08

Operational maturity milestone. The API gains production-ready observability
(Sentry), container-first deployment (multi-stage Dockerfile + docker-compose),
load-test scaffolding (k6), and a hardened CI pipeline that runs end-to-end
on every push.

### Added

- **Sentry SDK** wired from env in both the API (`@sentry/node` ^8) and web
  (`@sentry/nextjs` ^8). `SENTRY_DSN` empty ⇒ SDK is a no-op, so dev / test
  / local environments work without a Sentry project. Capture points:
  unhandled errors (with `requestId` / `method` / `path` context), email-send
  failures, S3 presign failures. Graceful shutdown calls `flushSentry(2000)`
  before exit. The web app uses `withSentryConfig` + `dryRun` / `silent` /
  `disable` when `SENTRY_AUTH_TOKEN` is empty so dev / CI builds stay quiet.
- **Prisma seed script** (`apps/api/prisma/seed.ts`) for local dev and the
  k6 load test. Creates three demo users with a shared known password
  (`Password123!`): `creator@…` (verified creator), `fan@…` (verified fan
  with `genrePrefs`), `unverified@…` (no role, unverified email).
  Idempotent. Wired as the Prisma seed entrypoint via `prisma.seed` in
  `apps/api/package.json`, plus `db:seed` and `db:reset` scripts.
- **k6 load test harness** (`tools/k6/smoke.js` + README). 50 RPS sustained
  across two scenarios for 30 s each — `POST /api/auth/login` (25 RPS,
  bcrypt verify) and `GET /api/fans/me` (25 RPS, JWT + Prisma). Thresholds:
  `p(95) < 500ms` per scenario, `http_req_failed < 1%`. One VU logs in at
  `setup()`, all VUs share the JWT (production-realistic steady state).
- **Multi-stage Dockerfile** for the API (`apps/api/Dockerfile`).
  `deps` → `builder` → `runner` with BuildKit `pnpm` cache mount, non-root
  user, `tini`, `/readyz` healthcheck, and an entrypoint that runs
  `prisma db push` then exec's the server. Self-contained prod deployment
  via `pnpm deploy --prod`.
- **`docker-compose.yml`** with two profiles — `--profile postgres` (default,
  prod-parity: Postgres 16 + MinIO + Mailpit) and `--profile sqlite`
  (zero-dependency dev: SQLite file in a volume + MinIO + Mailpit). `JWT_SECRET`
  is the only required env var. `minio-bucket-init` creates the `avatars`
  bucket on first run.
- **`.dockerignore`** at `apps/api/` to keep the build context lean
  (excludes `node_modules`, `.git`, `dist`, `.next`, `.env`, IDE files, etc.).
- **`docker-entrypoint.sh`** — runs `npx prisma db push --skip-generate
--accept-data-loss` then exec's the CMD, so SIGTERM propagates correctly
  to the Node process.
- **`.env.example`** at the repo root for docker-compose. Documents every
  var with sensible defaults.
- **Deploy API workflow** (`.github/workflows/deploy-api.yml`). Builds
  multi-arch (`linux/amd64`, `linux/arm64`) with BuildKit `type=gha` cache,
  pushes to `ghcr.io/${{ github.repository_owner }}/api` (tags: short SHA
  and the `latest` tag on `main`), then `curl POST` to `RENDER_DEPLOY_HOOK_URL`.
  `permissions: packages: write` (minimum for GHCR push). Sentry release
  tagged with the commit SHA.
- **`tools/ci-local.sh`** — one-command local CI suite. Mirrors every
  command each of the 7 CI workflows actually executes (`pnpm install
--frozen-lockfile` + 5 turbo commands + docs lints + `docker build`).
  Uses `set -o pipefail` so pnpm / docker exit codes aren't swallowed by
  `tail`. Colorized output, per-step timings, `--no-docker` / `--quick` /
  `--no-color` flags, graceful skip if docker is missing, exit code = number
  of failed steps.
- **`.npmrc`** at the repo root with `engine-strict=true` and
  `auto-install-peers=true`. Catches Node / pnpm / peer-dep mismatches at
  install time instead of at the next typecheck.
- **This CHANGELOG**.

### Changed

- **README.md** — added the "Sentry", "Docker / docker-compose", "k6 load
  tests", and "Deploy (Render + GHCR)" notes inline with the existing
  Features and Tech Stack sections, and a "Verify CI locally before
  pushing" subsection pointing at `tools/ci-local.sh`.
- **`apps/api/.env.example`** — added Sentry vars (`SENTRY_DSN`,
  `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`) and
  an optional `AWS_S3_ENDPOINT` for S3-compatible stores (MinIO,
  LocalStack, R2).
- **`apps/web/.env.example`** — added Sentry vars (`NEXT_PUBLIC_SENTRY_DSN`,
  `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`,
  `NEXT_PUBLIC_SENTRY_RELEASE`) plus server-only
  `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` for build-time
  source map upload.
- **`apps/web/next.config.mjs`** — wrapped with `withSentryConfig`.
  `dryRun` / `silent` / `disable` when `SENTRY_AUTH_TOKEN` is empty so dev
  and CI builds stay quiet.
- **`apps/api/package.json`** — added `db:seed` and `db:reset` scripts
  alongside the existing `dev` / `build` / `start` / `lint` / `typecheck`
  / `test` scripts, plus a top-level `"prisma": { "seed": "tsx
prisma/seed.ts" }` block so `prisma db seed` Just Works.
- **Root `package.json`** — `pnpm.onlyBuiltDependencies` whitelist now
  includes `@sentry/cli` and `sharp` (in addition to the existing
  `@prisma/client` / `@prisma/engines` / `esbuild` / `prisma` entries).
  Without this, the Sentry CLI's native binary wouldn't download and the
  deploy-api image build would fail.
- **All 7 `.github/workflows/*.yml`** — pinned `pnpm@10.6.5` explicitly via
  `pnpm/action-setup@v4.with.version` (was previously implicit through
  `packageManager` + corepack, which can resolve a different pnpm major
  on some runners and fail the lockfileVersion 9.0 hash check).
- **`apps/api/Dockerfile`** — `pnpm deploy` now uses `--legacy` (pnpm v10's
  default `deploy` requires `inject-workspace-packages=true` workspace-wide,
  which we don't want because it changes resolution semantics for every
  pnpm command). A `TODO(when pnpm vN: remove --legacy)` block documents
  the migration path; `pnpm-workspace.yaml` has a reciprocal pointer.

### Fixed

- All 7 GitHub Actions workflows (`api`, `web`, `shared`, `stellar`,
  `mobile`, `docs`, `deploy-api`) were failing on push to `main` in 11–16 s
  with a `pnpm install --frozen-lockfile` failure. Three interacting
  causes, three fixes: (1) `pnpm` version drift on CI (now pinned), (2)
  `@sentry/cli` and `sharp` postinstall scripts were silently skipped in
  CI's strict mode (now whitelisted), (3) lockfile integrity (regenerated
  from scratch).
- `apps/api/Dockerfile` build itself: removed a broken `COPY ... 2>/dev/null
|| true` line (Docker parsed the shell syntax as part of the source
  path and errored with `failed to compute cache key... "/||": not found`).
  The line was redundant — `pnpm deploy --prod` already bundles the
  generated Prisma client.
- The `@sentry/nextjs: ^8` dep that was added locally during the Sentry
  commit but never included in that commit's `git add` list. The lockfile
  (committed) had the entry, so a fresh `git clone` + `pnpm install
--frozen-lockfile` would have failed.
- Docs CI: the linter was scanning `node_modules` (1,573 vendor markdown
  files, 133k+ false positives) because the glob had no exclusion. Added
  `!**/node_modules/**` and `!**/.git/**` to the markdownlint-cli2
  invocation.
- Docs CI: the link-check's `Accept: application/vnd.github+json` header
  override was applied to all of `github.com`, which made HTML pages like
  `/releases` return 406 (Not Acceptable). Narrowed the override to just
  `api.github.com` so the HTML pages are checked with default headers.
- Docs CI: discontinued the `MD060` table-column-style rule (cosmetic
  preference, not a bug — 128 findings across all markdown tables, no
  real markdown issue).

### Security

- Sentry capture is opt-in via `SENTRY_DSN` and uses `sendDefaultPii: false`
  by default in both the API and the web app. PII (email, IP, user agent)
  is not sent unless explicitly enabled.
- Container runs as a non-root user (`uid=1001`), with the application
  directory writable only by that user.

## [0.1.0] - 2026-07-08

Initial feature-complete foundation. A TypeScript monorepo with a
modular Express API, Next.js portal, Expo mobile client, and two shared
packages (`@universal-healthcare/shared` for Zod schemas + DTOs,
`@universal-healthcare/stellar` as a compile-only scaffold for a future
Stellar integration).

### Added

- **Initial monorepo foundation**: pnpm + Turborepo workspace with five
  packages (`@universal-healthcare/api`, `web`, `mobile`, `shared`,
  `stellar`); the first `/api/*` surface (auth, users, creators, fans
  modules); the first `/health`, `/livez`, `/readyz`, `/metrics` health
  endpoints; helmet + CORS + per-IP rate limiting + JSON-structured
  logger; the first six CI workflows (api, web, shared, stellar, mobile,
  docs); the original `README.md` and `docs/` (architecture, contributing,
  testing, environment, security).
- **Phase 2 — Auth**: refresh-token rotation (opaque 32-byte hex tokens,
  SHA-256-hashed in DB, one-time-use with `jti`-keyed access JWTs,
  **replay detection** revokes all refresh tokens for the user when a
  revoked token is presented), email verification
  (`POST /api/auth/verify-email`, `POST /api/auth/resend-verification`),
  password reset (`POST /api/auth/forgot-password`,
  `POST /api/auth/reset-password` with a `PASSWORD_REUSED` guard), and an
  activation flow where `POST /api/auth/register` requires `role: "creator"
| "fan"` + `displayName` + optional `profile` and atomically creates the
  User + CreatorProfile (with an auto-generated unique slug) or FanProfile
  in one Prisma transaction.
- **Phase 2 — Creators list**: shared `paginationSchema` + `PaginationMeta` +
  `PaginatedResponse<T>` in `packages/shared`; `GET /api/creators?page=
&pageSize=&search=` — public, ordered by `createdAt desc`.
- **Phase 2 — Web client**: `auth-client` methods for refresh, logout,
  verify-email, resend-verification, forgot-password, reset-password;
  `auth-context` stores both access + refresh tokens; the register form
  has a role selector + role-specific profile fields.

### Security

- Helmet security headers on every response, CORS allowlist driven by
  `CORS_ORIGINS` (empty list = allow all in dev only), per-IP rate
  limiting on all `/api/*` routes, JWT bearer auth with a `requireAuth`
  middleware, and a centralized typed error model (`AppError` with
  `statusCode` + machine-readable `code`).
- Passwords hashed server-side with bcrypt. Plaintext never leaves the
  API.
- Request ID (`X-Request-Id`): trust upstream if it matches
  `[A-Za-z0-9._-]{1,128}`, otherwise generate a UUID v4. Echoed in the
  response header and in every structured log line.
