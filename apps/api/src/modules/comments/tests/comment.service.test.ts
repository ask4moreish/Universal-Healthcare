import { describe, it, expect } from 'vitest'
import { prisma } from '../../../shared/database/prisma.js'
import { commentService } from '../services/comment.service.js'
import { AppError } from '../../../shared/errors/app-error.js'

// ─── helpers ────────────────────────────────────────────────────────────────

let userCounter = 0
async function makeUser(): Promise<{ id: string; email: string }> {
  userCounter += 1
  const u = await prisma.user.create({
    data: {
      email: `c-test-u${userCounter}-${Date.now()}-${Math.random().toString(36).slice(2)}@e.com`,
      passwordHash: 'x',
    },
  })
  return { id: u.id, email: u.email }
}

async function makePlaylist(
  userId: string,
  isPublic = true
): Promise<{ id: string }> {
  const p = await prisma.playlist.create({
    data: { userId, title: 'p', isPublic },
  })
  return { id: p.id }
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('commentService', () => {
  // ─── listForPlaylist ────────────────────────────────────────────────────
  describe('listForPlaylist', () => {
    it('404s when the playlist does not exist', async () => {
      await expect(
        commentService.listForPlaylist('does-not-exist', 1, 20)
      ).rejects.toBeInstanceOf(AppError)
    })

    it('404s when the playlist is private (does not leak existence)', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, false)
      await expect(
        commentService.listForPlaylist(p.id, 1, 20)
      ).rejects.toMatchObject({ statusCode: 404, code: 'PLAYLIST_NOT_FOUND' })
    })

    it('returns an empty list for a public playlist with no comments', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, true)
      const res = await commentService.listForPlaylist(p.id, 1, 20)
      expect(res.items).toEqual([])
      expect(res.total).toBe(0)
    })

    it('only returns top-level comments (parentId IS NULL)', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, true)
      const top = await commentService.create(
        { playlistId: p.id, parentId: null, body: 'top-1' },
        u.id
      )
      await commentService.create(
        { playlistId: p.id, parentId: top.id, body: 'reply-1' },
        u.id
      )
      await commentService.create(
        { playlistId: p.id, parentId: null, body: 'top-2' },
        u.id
      )

      const res = await commentService.listForPlaylist(p.id, 1, 20)
      expect(res.total).toBe(2)
      expect(res.items.map((c) => c.body)).toEqual(['top-1', 'top-2'])
    })

    it('paginates results by createdAt asc and pageSize', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, true)
      for (let i = 0; i < 7; i++) {
        await commentService.create(
          { playlistId: p.id, parentId: null, body: `c${i}` },
          u.id
        )
      }
      const p1 = await commentService.listForPlaylist(p.id, 1, 3)
      const p2 = await commentService.listForPlaylist(p.id, 2, 3)
      const p3 = await commentService.listForPlaylist(p.id, 3, 3)
      expect(p1.items.map((c) => c.body)).toEqual(['c0', 'c1', 'c2'])
      expect(p2.items.map((c) => c.body)).toEqual(['c3', 'c4', 'c5'])
      expect(p3.items.map((c) => c.body)).toEqual(['c6'])
      expect([p1.total, p2.total, p3.total]).toEqual([7, 7, 7])
    })
  })

  // ─── create ─────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates a top-level comment', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, true)
      const c = await commentService.create(
        { playlistId: p.id, parentId: null, body: 'first!' },
        u.id
      )
      expect(c.playlistId).toBe(p.id)
      expect(c.userId).toBe(u.id)
      expect(c.parentId).toBeNull()
      expect(c.body).toBe('first!')
    })

    it('creates a reply when parentId refers to a sibling comment', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, true)
      const parent = await commentService.create(
        { playlistId: p.id, parentId: null, body: 'parent' },
        u.id
      )
      const reply = await commentService.create(
        { playlistId: p.id, parentId: parent.id, body: 'reply' },
        u.id
      )
      expect(reply.parentId).toBe(parent.id)
      expect(reply.playlistId).toBe(p.id)
    })

    it('rejects with INVALID_PARENT if the parent is in a different playlist', async () => {
      const u = await makeUser()
      const p1 = await makePlaylist(u.id, true)
      const p2 = await makePlaylist(u.id, true)
      const foreign = await commentService.create(
        { playlistId: p1.id, parentId: null, body: 'foreign' },
        u.id
      )
      await expect(
        commentService.create(
          { playlistId: p2.id, parentId: foreign.id, body: 'cross-playlist' },
          u.id
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_PARENT' })
    })

    it('rejects with INVALID_PARENT if the parent does not exist', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, true)
      await expect(
        commentService.create(
          { playlistId: p.id, parentId: 'does-not-exist', body: 'orphan' },
          u.id
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_PARENT' })
    })

    it('rejects with PLAYLIST_NOT_FOUND if the target playlist is missing', async () => {
      const u = await makeUser()
      await expect(
        commentService.create(
          { playlistId: 'does-not-exist', parentId: null, body: 'orphan' },
          u.id
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'PLAYLIST_NOT_FOUND',
      })
    })

    it('rejects creating a comment on a private playlist (does not leak existence)', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, false)
      await expect(
        commentService.create(
          { playlistId: p.id, parentId: null, body: 'private' },
          u.id
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'PLAYLIST_NOT_FOUND',
      })
    })
  })

  // ─── getById ────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('returns the comment when present', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, true)
      const created = await commentService.create(
        { playlistId: p.id, parentId: null, body: 'hi' },
        u.id
      )
      const fetched = await commentService.getById(created.id)
      expect(fetched.id).toBe(created.id)
    })

    it('404s when missing', async () => {
      await expect(
        commentService.getById('does-not-exist')
      ).rejects.toMatchObject({ statusCode: 404, code: 'COMMENT_NOT_FOUND' })
    })

    it('404s when the parent playlist has been flipped to private (does not leak)', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, true)
      const created = await commentService.create(
        { playlistId: p.id, parentId: null, body: 'was-public' },
        u.id
      )
      // Flip to private via prisma, bypassing the service.
      await prisma.playlist.update({
        where: { id: p.id },
        data: { isPublic: false },
      })
      await expect(commentService.getById(created.id)).rejects.toMatchObject({
        statusCode: 404,
        code: 'COMMENT_NOT_FOUND',
      })
    })
  })

  // ─── update ─────────────────────────────────────────────────────────────
  describe('update', () => {
    it('owner can update', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, true)
      const created = await commentService.create(
        { playlistId: p.id, parentId: null, body: 'old' },
        u.id
      )
      const updated = await commentService.update(
        created.id,
        { body: 'new' },
        u.id
      )
      expect(updated.body).toBe('new')
    })

    it('non-owner gets 403', async () => {
      const author = await makeUser()
      const intruder = await makeUser()
      const p = await makePlaylist(author.id, true)
      const created = await commentService.create(
        { playlistId: p.id, parentId: null, body: 'mine' },
        author.id
      )
      await expect(
        commentService.update(created.id, { body: 'yours' }, intruder.id)
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' })
    })
  })

  // ─── delete ─────────────────────────────────────────────────────────────
  describe('delete', () => {
    it('owner can delete', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, true)
      const created = await commentService.create(
        { playlistId: p.id, parentId: null, body: 'bye' },
        u.id
      )
      await commentService.delete(created.id, u.id)
      await expect(commentService.getById(created.id)).rejects.toMatchObject({
        statusCode: 404,
        code: 'COMMENT_NOT_FOUND',
      })
    })

    it('non-owner gets 403', async () => {
      const author = await makeUser()
      const intruder = await makeUser()
      const p = await makePlaylist(author.id, true)
      const created = await commentService.create(
        { playlistId: p.id, parentId: null, body: 'mine' },
        author.id
      )
      await expect(
        commentService.delete(created.id, intruder.id)
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' })
    })

    it('cascades replies when a parent comment is deleted', async () => {
      const u = await makeUser()
      const p = await makePlaylist(u.id, true)
      const parent = await commentService.create(
        { playlistId: p.id, parentId: null, body: 'parent' },
        u.id
      )
      const reply = await commentService.create(
        { playlistId: p.id, parentId: parent.id, body: 'reply' },
        u.id
      )
      await commentService.delete(parent.id, u.id)
      await expect(commentService.getById(reply.id)).rejects.toMatchObject({
        statusCode: 404,
        code: 'COMMENT_NOT_FOUND',
      })
    })
  })
})
