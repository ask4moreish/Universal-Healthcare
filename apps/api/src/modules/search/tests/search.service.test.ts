import { describe, it, expect } from 'vitest'
import { prisma } from '../../../shared/database/prisma.js'
import { searchService } from '../services/search.service.js'

// ─── helpers ────────────────────────────────────────────────────────────────

let userCounter = 0
async function makeUser(): Promise<{ id: string }> {
  userCounter += 1
  const u = await prisma.user.create({
    data: {
      email: `s-u${userCounter}-${Date.now()}-${Math.random().toString(36).slice(2)}@e.com`,
      passwordHash: 'x',
    },
  })
  return { id: u.id }
}

async function makeCreator(
  userId: string,
  displayName: string,
  bio: string | null = null
): Promise<{ id: string; displayName: string }> {
  const c = await prisma.creatorProfile.create({
    data: {
      userId,
      displayName,
      // Suffix with random to avoid the slug unique-constraint collision
      // across multiple test rows with the same displayName.
      slug:
        displayName.toLowerCase().replace(/\s+/g, '-') +
        '-' +
        Math.random().toString(36).slice(2, 8),
      bio,
    },
  })
  return { id: c.id, displayName: c.displayName }
}

async function makePlaylist(
  userId: string,
  isPublic: boolean,
  title: string
): Promise<{ id: string; title: string }> {
  const p = await prisma.playlist.create({
    data: { userId, title, isPublic },
  })
  return { id: p.id, title: p.title }
}

async function makeComment(
  userId: string,
  playlistId: string,
  body: string
): Promise<{ id: string; body: string }> {
  const c = await prisma.comment.create({
    data: { userId, playlistId, body, parentId: null },
  })
  return { id: c.id, body: c.body }
}

const baseOpts = {
  page: 1,
  pageSize: 20,
  limit: 20,
  types: [] as ('creator' | 'playlist' | 'comment')[],
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('searchService.search', () => {
  it('returns an empty result for a whitespace-only query', async () => {
    const res = await searchService.search({ ...baseOpts, q: '   ' })
    expect(res.data).toEqual([])
    expect(res.pagination.total).toBe(0)
  })

  it('matches creators by displayName (case-INsensitive on SQLite LIKE, case-sensitive on Postgres LIKE — cross-DB inconsistency is a v1 limitation, see CHANGELOG)', async () => {
    const u = await makeUser()
    const c = await makeCreator(u.id, 'Solar Vibes')
    // Lowercase query against capitalized data — matches on SQLite (LIKE is
    // case-insensitive for ASCII by default), would NOT match on Postgres
    // without `mode: 'insensitive'`. This test passes in dev (SQLite); the
    // production-deployed behavior is a known v1 gap.
    const res = await searchService.search({ ...baseOpts, q: 'solar' })
    expect(res.data.some((h) => h.type === 'creator' && h.id === c.id)).toBe(
      true
    )
  })

  it('ranks an exact match above a substring match', async () => {
    const uExact = await makeUser()
    const uPartial = await makeUser()
    // Two distinct users — CreatorProfile.userId is `@unique` on the
    // schema, so we can't have one user own both profiles.
    const exact = await makeCreator(uExact.id, 'Apollo', null)
    const partial = await makeCreator(uPartial.id, 'DJ Apollo Sound', null)
    const res = await searchService.search({ ...baseOpts, q: 'Apollo' })
    const exactHit = res.data.find((h) => h.id === exact.id)
    const partialHit = res.data.find((h) => h.id === partial.id)
    expect(exactHit).toBeDefined()
    expect(partialHit).toBeDefined()
    // Both hits share the same `score` field on the discriminated union's
    // base — no cast needed.
    expect(exactHit!.score).toBeGreaterThan(partialHit!.score)
  })

  it('excludes private playlists from results (privacy gate)', async () => {
    const u = await makeUser()
    const pub = await makePlaylist(u.id, true, 'Public Beats')
    const priv = await makePlaylist(u.id, false, 'Private Beats')
    const res = await searchService.search({ ...baseOpts, q: 'Beats' })
    const ids = res.data.filter((h) => h.type === 'playlist').map((h) => h.id)
    expect(ids).toContain(pub.id)
    expect(ids).not.toContain(priv.id)
  })

  it('excludes comments on private playlists from results (privacy gate)', async () => {
    const u = await makeUser()
    const pub = await makePlaylist(u.id, true, 'Public')
    const priv = await makePlaylist(u.id, false, 'Private')
    const pubComment = await makeComment(u.id, pub.id, 'needle-public-marker')
    const privComment = await makeComment(u.id, priv.id, 'needle-private-marker')
    const res = await searchService.search({ ...baseOpts, q: 'needle' })
    const ids = res.data.filter((h) => h.type === 'comment').map((h) => h.id)
    expect(ids).toContain(pubComment.id)
    expect(ids).not.toContain(privComment.id)
  })

  it('respects the types filter (only returns the requested entity type)', async () => {
    const u = await makeUser()
    const c = await makeCreator(u.id, 'Apollo', null)
    const p = await makePlaylist(u.id, true, 'Apollo Mix')
    const cm = await makeComment(u.id, p.id, 'Apollo is great')
    const res = await searchService.search({
      ...baseOpts,
      q: 'Apollo',
      types: ['creator'],
    })
    expect(res.data.every((h) => h.type === 'creator')).toBe(true)
    expect(res.data.some((h) => h.id === c.id)).toBe(true)
    expect(res.data.some((h) => h.id === p.id)).toBe(false)
    expect(res.data.some((h) => h.id === cm.id)).toBe(false)
  })

  it('paginates merged cross-entity results with `total` summed across types', async () => {
    // 15 distinct users for 15 distinct creator profiles — CreatorProfile.userId
    // is `@unique` on the schema, so we can't reuse a single user.
    const creatorUsers = await Promise.all(
      Array.from({ length: 15 }, () => makeUser())
    )
    for (let i = 0; i < 15; i++) {
      await makeCreator(creatorUsers[i]!.id, `TokenCreator${i}`)
    }
    // 15 distinct users for 15 distinct playlists.
    const playlistUsers = await Promise.all(
      Array.from({ length: 15 }, () => makeUser())
    )
    for (let i = 0; i < 15; i++) {
      await makePlaylist(playlistUsers[i]!.id, true, `TokenPlaylist${i}`)
    }
    const p1 = await searchService.search({
      ...baseOpts,
      q: 'Token',
      page: 1,
      pageSize: 20,
    })
    expect(p1.data.length).toBe(20)
    expect(p1.pagination.total).toBe(30)
    expect(p1.pagination.totalPages).toBe(2)
    const p2 = await searchService.search({
      ...baseOpts,
      q: 'Token',
      page: 2,
      pageSize: 20,
    })
    expect(p2.data.length).toBe(10)
  })

  it('AND-s multi-token queries (every token must match the same row)', async () => {
    const u1 = await makeUser()
    const u2 = await makeUser()
    const u3 = await makeUser()
    // Three distinct users — CreatorProfile.userId is `@unique`.
    await makeCreator(u1.id, 'Apollo', null)
    await makeCreator(u2.id, 'Vibes', null)
    await makeCreator(u3.id, 'Apollo Vibes', null)
    const res = await searchService.search({ ...baseOpts, q: 'Apollo Vibes' })
    expect(res.data.length).toBe(1)
    // Discriminated union narrowing: the only result is a creator, so we
    // can read `displayName` without a cast.
    expect(res.data[0]!.type).toBe('creator')
    if (res.data[0]!.type === 'creator') {
      expect(res.data[0]!.displayName).toBe('Apollo Vibes')
    }
  })
})
