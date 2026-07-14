import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../app.js'
import { AppError } from '../../../shared/errors/app-error.js'

// Mock the service so the test exercises the router + controller + auth
// middleware, but never reaches the database. This is the "Layer A" pattern
// mirrored from apps/api/src/modules/playlists/tests/playlist.routes.test.ts.
vi.mock('../services/comment.service.js', () => ({
  commentService: {
    listForPlaylist: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

// Imported AFTER the mock so the call sites are bound to vi.fn().
const { commentService } = await import('../services/comment.service.js')
const mockedService = commentService as unknown as {
  listForPlaylist: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  getById: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

describe('commentRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────
  //  Public endpoints (no requireAuth gate before them)
  // ─────────────────────────────────────────────────────────────────

  describe('GET /api/comments/playlists/:playlistId (public list)', () => {
    it('returns 200 with the default pagination envelope', async () => {
      mockedService.listForPlaylist.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      })

      const res = await request(createApp()).get('/api/comments/playlists/p-1')

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      })
      expect(mockedService.listForPlaylist).toHaveBeenCalledWith('p-1', 1, 20)
    })

    it('passes through query-string page + pageSize to the service', async () => {
      mockedService.listForPlaylist.mockResolvedValue({
        items: [],
        total: 0,
        page: 3,
        pageSize: 5,
      })

      const res = await request(createApp()).get(
        '/api/comments/playlists/p-1?page=3&pageSize=5'
      )

      expect(res.status).toBe(200)
      expect(mockedService.listForPlaylist).toHaveBeenCalledWith('p-1', 3, 5)
      expect(res.body.pagination).toMatchObject({
        page: 3,
        pageSize: 5,
        hasPrev: true,
        hasNext: false,
      })
    })

    it('returns 404 propagated from the service', async () => {
      mockedService.listForPlaylist.mockRejectedValue(
        new AppError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found')
      )

      const res = await request(createApp()).get(
        '/api/comments/playlists/missing'
      )

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/comments/:id (public single)', () => {
    it('returns 200 with the comment DTO when found', async () => {
      const fake = {
        id: 'c-1',
        userId: 'u-1',
        playlistId: 'p-1',
        parentId: null,
        body: 'hi',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }
      mockedService.getById.mockResolvedValue(fake)

      const res = await request(createApp()).get('/api/comments/c-1')

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe('c-1')
      expect(res.body.data.createdAt).toBe('2026-01-01T00:00:00.000Z')
      expect(mockedService.getById).toHaveBeenCalledWith('c-1')
    })

    it('returns 404 when missing', async () => {
      mockedService.getById.mockRejectedValue(
        new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found')
      )

      const res = await request(createApp()).get('/api/comments/missing')

      expect(res.status).toBe(404)
    })
  })

  // ─────────────────────────────────────────────────────────────────
  //  Protected endpoints — requireAuth gate
  // ─────────────────────────────────────────────────────────────────

  describe('POST /api/comments/playlists/:playlistId (auth required)', () => {
    it('returns 401 without a Bearer token', async () => {
      const res = await request(createApp())
        .post('/api/comments/playlists/p-1')
        .send({ body: 'hello' })

      expect(res.status).toBe(401)
      expect(mockedService.create).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /api/comments/:id (auth required)', () => {
    it('returns 401 without a Bearer token', async () => {
      const res = await request(createApp())
        .patch('/api/comments/c-1')
        .send({ body: 'edited' })

      expect(res.status).toBe(401)
      expect(mockedService.update).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/comments/:id (auth required)', () => {
    it('returns 401 without a Bearer token', async () => {
      const res = await request(createApp()).delete('/api/comments/c-1')

      expect(res.status).toBe(401)
      expect(mockedService.delete).not.toHaveBeenCalled()
    })
  })
})
