import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../app.js'

// Mock the service so the test exercises the router + controller + Zod
// validation, but never reaches the database. This is the "Layer A" pattern
// mirrored from apps/api/src/modules/comments/tests/comment.routes.test.ts.
vi.mock('../services/search.service.js', () => ({
  searchService: {
    search: vi.fn(),
  },
}))

// Imported AFTER the mock so the call sites are bound to vi.fn().
const { searchService } = await import('../services/search.service.js')
const mockedService = searchService as unknown as {
  search: ReturnType<typeof vi.fn>
}

describe('searchRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock: an empty envelope, matching the real service shape.
    mockedService.search.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    })
  })

  describe('GET /api/search', () => {
    it('returns 200 with the default envelope when q is present', async () => {
      const res = await request(createApp()).get('/api/search?q=foo')
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      })
    })

    it('returns 400 when q is missing (Zod min(1))', async () => {
      const res = await request(createApp()).get('/api/search')
      expect(res.status).toBe(400)
      expect(mockedService.search).not.toHaveBeenCalled()
    })

    it('returns 400 when q is the empty string', async () => {
      const res = await request(createApp()).get('/api/search?q=')
      expect(res.status).toBe(400)
      expect(mockedService.search).not.toHaveBeenCalled()
    })

    it('returns 400 when types contains an unknown value', async () => {
      const res = await request(createApp()).get(
        '/api/search?q=foo&types=bogus,creator'
      )
      expect(res.status).toBe(400)
      expect(mockedService.search).not.toHaveBeenCalled()
    })

    it('parses comma-separated types and forwards them to the service', async () => {
      const res = await request(createApp()).get(
        '/api/search?q=foo&types=creator,playlist'
      )
      expect(res.status).toBe(200)
      expect(mockedService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'foo',
          types: ['creator', 'playlist'],
        })
      )
    })

    it('forwards page + pageSize + limit to the service', async () => {
      const res = await request(createApp()).get(
        '/api/search?q=foo&page=2&pageSize=5&limit=3'
      )
      expect(res.status).toBe(200)
      expect(mockedService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'foo',
          page: 2,
          pageSize: 5,
          limit: 3,
        })
      )
    })

    it('returns 400 when page is out of range', async () => {
      const res = await request(createApp()).get('/api/search?q=foo&page=0')
      expect(res.status).toBe(400)
    })

    it('returns 400 when limit exceeds SEARCH_LIMIT_MAX', async () => {
      const res = await request(createApp()).get(
        '/api/search?q=foo&limit=999'
      )
      expect(res.status).toBe(400)
    })
  })
})
