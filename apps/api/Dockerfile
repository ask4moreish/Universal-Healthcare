# syntax=docker/dockerfile:1.6

# ────────────────────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for @universal-healthcare/api
#   deps    – pnpm fetch + install (cached via BuildKit mount)
#   builder – prisma generate + tsc + `pnpm deploy --prod`
#   runner  – distroless-style non-root runtime with /readyz healthcheck
# ────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20
ARG PNPM_VERSION=10.6.5

# ─── Stage 1: dependencies ──────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /workspace

# Copy manifests only — this layer caches well across source-only changes
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Cache pnpm store + install
RUN --mount=type=cache,target=/pnpm/store \
    pnpm fetch --frozen-lockfile
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile \
      --filter @universal-healthcare/api... \
      --filter @universal-healthcare/shared...

# ─── Stage 2: build ────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder
ARG SENTRY_RELEASE=""
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /workspace

# Copy deps + sources
COPY --from=deps /workspace/ ./
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Generate Prisma client + TypeScript build
RUN pnpm --filter @universal-healthcare/api exec prisma generate
RUN pnpm --filter @universal-healthcare/api build

# Produce a self-contained production deployment (pruned deps + workspace pkgs)
RUN pnpm --filter @universal-healthcare/api deploy --prod /app/deploy

# ─── Stage 3: runtime ──────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache wget tini
WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S app && adduser -S -u 1001 -G app app

# Self-contained prod deployment from the builder
COPY --from=builder --chown=app:app /app/deploy ./

# Prisma schema + generated client (for migrations at container start)
COPY --from=builder --chown=app:app /workspace/apps/api/prisma ./prisma
COPY --from=builder --chown=app:app /workspace/node_modules/.prisma ./node_modules/.prisma 2>/dev/null || true

# Container entrypoint runs `prisma db push` then exec's the CMD
COPY --chown=app:app apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER app
EXPOSE 4000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/readyz || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/server.js"]
