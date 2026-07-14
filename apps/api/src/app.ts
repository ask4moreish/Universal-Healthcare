import express, { type Express } from 'express'
import compression from 'compression'
import cors from 'cors'
import helmet from 'helmet'
import { authRouter } from './modules/auth/routes/auth.routes.js'
import { commentRouter } from './modules/comments/routes/comment.routes.js'
import { creatorsRouter } from './modules/creators/routes/creator.routes.js'
import { fansRouter } from './modules/fans/routes/fan.routes.js'
import { followRouter } from './modules/follows/routes/follow.routes.js'
import { notificationRouter } from './modules/notifications/routes/notification.routes.js'
import { playlistsRouter } from './modules/playlists/routes/playlist.routes.js'
import { usersRouter } from './modules/users/routes/user.routes.js'
import { env } from './shared/config/env.js'
import { prisma } from './shared/database/prisma.js'
import { errorHandler } from './shared/middleware/error-handler.js'
import { buildRateLimiter } from './shared/middleware/rate-limit.middleware.js'
import { requestId } from './shared/middleware/request-id.middleware.js'
import { requestLogger } from './shared/middleware/request-logger.middleware.js'
import { metricsMiddleware } from './shared/observability/metrics.middleware.js'
import {
  httpRequestDurationSeconds,
  httpRequestsInFlight,
  httpRequestsTotal,
  metricsSnapshot,
} from './shared/observability/metrics.js'

export function createApp(): Express {
  const app = express()

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1)
  }

  // 1. Trust-proxy-aware IP, then security headers, then CORS.
  //    helmet's default crossOriginResourcePolicy is "same-origin", which would
  //    block the web app from reading cross-origin API responses — relax it.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  )
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true)
        if (
          env.CORS_ORIGINS.length === 0 ||
          env.CORS_ORIGINS.includes(origin)
        ) {
          return cb(null, true)
        }
        return cb(new Error(`CORS: origin ${origin} not allowed`))
      },
      credentials: true,
    })
  )
  app.use(compression())

  // 2. Observability primitives that must wrap every request.
  app.use(requestId())
  app.use(requestLogger())
  app.use(metricsMiddleware())

  // 3. Body parser (after observability so JSON parse failures still get logged).
  app.use(express.json({ limit: '1mb' }))

  // 4. Rate limiting (per-IP) — applied to /api/* only via mount path below.
  const apiRateLimiter = buildRateLimiter()

  // 5. Health & observability endpoints (no rate limit, no auth).
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' })
  })

  app.get('/livez', (_req, res) => {
    res.status(200).json({ status: 'alive' })
  })

  app.get('/readyz', async (_req, res) => {
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('db ping timeout')), 2_000)
        ),
      ])
      res.status(200).json({ status: 'ready' })
    } catch (err) {
      res.status(503).json({
        status: 'not_ready',
        error: (err as Error).message,
      })
    }
  })

  app.get('/metrics', async (_req, res) => {
    const snap = await metricsSnapshot()
    res.setHeader('Content-Type', snap.contentType)
    res.status(200).send(snap.body)
  })

  // 6. API routes — all under /api, with rate limiting.
  app.use('/api', apiRateLimiter)
  app.use('/api/auth', authRouter)
  app.use('/api/comments', commentRouter)
  app.use('/api/creators', creatorsRouter)
  app.use('/api/follows', followRouter)
  app.use('/api/fans', fansRouter)
  app.use('/api/notifications', notificationRouter)
  app.use('/api/playlists', playlistsRouter)
  app.use('/api/users', usersRouter)

  // 7. Error handler must be last.
  app.use(errorHandler)

  // Reference metrics symbols so they're emitted and tree-shake-safe.
  void httpRequestsTotal
  void httpRequestDurationSeconds
  void httpRequestsInFlight

  return app
}
