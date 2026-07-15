# k6 Load Tests

Smoke + steady-state load tests for the API. Runs against the local
docker-compose stack or any deployed environment that exposes the same
auth + fan endpoints.

## Prerequisites

- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) (`brew install k6`, `apt install k6`, etc.)
- The API reachable at `BASE_URL` with the seed users present.

## Seed the database

The smoke test logs in as a seeded fan user. Seed first:

```bash
# Postgres profile
docker compose --profile postgres exec -T api npx prisma db seed

# Or sqlite profile
docker compose --profile sqlite exec -T api npx prisma db seed
```

After seeding, three users exist with the same shared password
`Password123!`:

| Email                                   | Role      | Verified |
| --------------------------------------- | --------- | -------- |
| `creator@universal-healthcare.local`    | creator   | yes      |
| `fan@universal-healthcare.local`        | fan       | yes      |
| `unverified@universal-healthcare.local` | (no role) | no       |

## Run

```bash
# 50 RPS smoke against local docker-compose (30s login + 30s fans/me)
k6 run tools/k6/smoke.js

# Against a deployed env
BASE_URL=https://api.universal-healthcare.example k6 run tools/k6/smoke.js

# With a different seed user
SEED_EMAIL=fan@universal-healthcare.local \
SEED_PASSWORD=Password123! \
  k6 run tools/k6/smoke.js
```

## Scenarios

| Scenario  | RPS | Duration | What it tests                          |
| --------- | --- | -------- | -------------------------------------- |
| `login`   | 25  | 30s      | `POST /api/auth/login` (bcrypt verify) |
| `fans_me` | 25  | 30s      | `GET /api/fans/me` (JWT + Prisma)      |

Total: **50 RPS** sustained for ~32s (fans_me starts 2s after login).

## Thresholds (the run fails if any are breached)

| Metric                                | Target        |
| ------------------------------------- | ------------- |
| `http_req_duration{scenario:login}`   | p(95) < 500ms |
| `http_req_duration{scenario:fans_me}` | p(95) < 500ms |
| `http_req_failed`                     | rate < 1%     |
| `login_failures`                      | rate < 1%     |
| `fans_me_failures`                    | rate < 1%     |

## How auth works

A single VU runs `setup()` which logs in once and returns the access JWT.
All VUs share that token via the `data` parameter. This models a
production-realistic steady state (one user, many concurrent readers)
and keeps bcrypt cost out of the hot path. To switch to per-VU auth
instead, change `fansMeScenario` to call `loginScenario` first.

## Extending

Add a new scenario by:

1. Adding a new `scenarios:` block in `options`.
2. Adding a new `export function myScenario(data) { ... }`.
3. Updating the `thresholds:` block.

Keep total RPS at 50 for the smoke profile; add a separate file
(`tools/k6/stress.js`) for higher-rate tests.
