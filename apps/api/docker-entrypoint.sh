#!/bin/sh
# Container entrypoint for the API image.
#   1. Push the Prisma schema to the configured database (idempotent).
#   2. exec the CMD so SIGTERM propagates to the Node process.
set -e

echo "[entrypoint] prisma db push (apply schema to database)..."
npx prisma db push --skip-generate --accept-data-loss

echo "[entrypoint] starting: $*"
exec "$@"
