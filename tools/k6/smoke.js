// k6 smoke test — 50 RPS sustained across /api/auth/login and /api/fans/me.
//
// Run with:  k6 run tools/k6/smoke.js
// Override:  BASE_URL=... SEED_EMAIL=... SEED_PASSWORD=... k6 run tools/k6/smoke.js
//
// The test logs in once at setup() and shares the access JWT across all
// virtual users via the `data` parameter. This is the production-realistic
// steady state — one user, many concurrent readers — and avoids bcrypt
// cost dominating the test. To switch to per-VU auth, change fansMeScenario
// to call loginScenario() first.

import http from "k6/http"
import { check } from "k6"
import { Rate, Trend } from "k6/metrics"

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000"
const SEED_EMAIL = __ENV.SEED_EMAIL || "fan@universal-healthcare.local"
const SEED_PASSWORD = __ENV.SEED_PASSWORD || "Password123!"

const loginFailures = new Rate("login_failures")
const fansMeFailures = new Rate("fans_me_failures")

export const options = {
  scenarios: {
    login: {
      executor: "constant-arrival-rate",
      rate: 25, // 25 RPS for login (50 RPS total across both scenarios)
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 10,
      maxVUs: 50,
      exec: "loginScenario",
      tags: { scenario: "login" },
    },
    fans_me: {
      executor: "constant-arrival-rate",
      rate: 25,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 10,
      maxVUs: 50,
      exec: "fansMeScenario",
      tags: { scenario: "fans_me" },
      startTime: "2s", // slight offset so setup() can finish
    },
  },
  thresholds: {
    "http_req_duration{scenario:login}": ["p(95)<500"],
    "http_req_duration{scenario:fans_me}": ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    login_failures: ["rate<0.01"],
    fans_me_failures: ["rate<0.01"],
  },
}

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: SEED_EMAIL, password: SEED_PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  )
  check(loginRes, { "setup login 200": (r) => r.status === 200 })
  if (loginRes.status !== 200) {
    throw new Error(
      `Setup login failed: ${loginRes.status} ${loginRes.body}`
    )
  }
  const body = JSON.parse(loginRes.body)
  return { token: body.tokens.accessToken }
}

export function loginScenario() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: SEED_EMAIL, password: SEED_PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  )
  loginFailures.add(res.status !== 200)
  check(res, { "login 200": (r) => r.status === 200 })
}

export function fansMeScenario(data) {
  const res = http.get(`${BASE_URL}/api/fans/me`, {
    headers: { Authorization: `Bearer ${data.token}` },
  })
  fansMeFailures.add(res.status !== 200)
  check(res, { "fans/me 200": (r) => r.status === 200 })
}
