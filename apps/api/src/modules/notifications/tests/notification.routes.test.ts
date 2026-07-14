import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../app.js'

// Mock the entire service — Layer A test exercises the router + controller
// + auth gate without touching the DB.
vi.mock('../services/notification.service.js', () => ({
  notificationService: {
    listMine: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    delete: vi.fn(),
    emit: vi.fn(),
  },
}))

// Imported AFTER the mock so call sites are bound to vi.fn().
const { notificationService } =
  await import('../services/notification.service.js')
const mockedService = notificationService as unknown as {
  listMine: ReturnType<typeof vi.fn>
  markRead: ReturnType<typeof vi.fn>
  markAllRead: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
}

describe('notificationRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────────
  //  Entire router is auth-gated (notifications are private)
  // ─────────────────────────────────────────────────────────────────────────

  it('GET /api/notifications returns 401 without a token', async () => {
    const res = await request(createApp()).get('/api/notifications')
    expect(res.status).toBe(401)
    expect(mockedService.listMine).not.toHaveBeenCalled()
  })

  it('PATCH /api/notifications/:id/read returns 401 without a token', async () => {
    const res = await request(createApp()).patch('/api/notifications/n-1/read')
    expect(res.status).toBe(401)
    expect(mockedService.markRead).not.toHaveBeenCalled()
  })

  it('POST /api/notifications/read-all returns 401 without a token', async () => {
    const res = await request(createApp()).post('/api/notifications/read-all')
    expect(res.status).toBe(401)
    expect(mockedService.markAllRead).not.toHaveBeenCalled()
  })

  it('DELETE /api/notifications/:id returns 401 without a token', async () => {
    const res = await request(createApp()).delete('/api/notifications/n-1')
    expect(res.status).toBe(401)
    expect(mockedService.delete).not.toHaveBeenCalled()
  })

  // ─────────────────────────────────────────────────────────────────────────
  //  /api/notifications/unread-count-style auth gate is verified above.
  //  Authenticated happy paths are exercised by Layer B (notification.service.test.ts).
  //  We intentionally do NOT mock `requireAuth` here — keeping it real ensures
  //  any router-level regression (e.g. accidentally removing the gate) is caught.
  // ─────────────────────────────────────────────────────────────────────────
})
