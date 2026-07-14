import { prisma } from '../../../shared/database/prisma.js'
import type {
  CreatePlaylistInput,
  Playlist,
  Track,
  UpdatePlaylistInput,
} from '../types/playlist.types.js'

type RawTrack = {
  id: string
  playlistId: string
  title: string
  artist: string
  duration: number
  position: number
  createdAt: Date
  updatedAt: Date
}

type RawPlaylist = {
  id: string
  userId: string
  title: string
  isPublic: boolean
  tracks: RawTrack[]
  createdAt: Date
  updatedAt: Date
}

function trackFromPrisma(raw: RawTrack): Track {
  return { ...raw }
}

function playlistFromPrisma(raw: RawPlaylist): Playlist {
  return {
    id: raw.id,
    userId: raw.userId,
    title: raw.title,
    isPublic: raw.isPublic,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    tracks: raw.tracks.map(trackFromPrisma),
  }
}

export const playlistRepository = {
  async listByUserId(userId: string): Promise<Playlist[]> {
    const rows = await prisma.playlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { tracks: { orderBy: { position: 'asc' } } },
    })
    return rows.map(playlistFromPrisma)
  },

  async findById(id: string): Promise<Playlist | null> {
    const row = await prisma.playlist.findUnique({
      where: { id },
      include: { tracks: { orderBy: { position: 'asc' } } },
    })
    return row ? playlistFromPrisma(row) : null
  },

  async create(input: CreatePlaylistInput): Promise<Playlist> {
    const row = await prisma.playlist.create({
      data: {
        userId: input.userId,
        title: input.title,
        isPublic: input.isPublic,
        tracks: {
          create: input.tracks.map((t, position) => ({ ...t, position })),
        },
      },
      include: { tracks: { orderBy: { position: 'asc' } } },
    })
    return playlistFromPrisma(row)
  },

  async setTracks(
    playlistId: string,
    tracks: Array<Pick<Track, 'title' | 'artist' | 'duration'>>
  ): Promise<void> {
    // Sanctioned prisma.$transaction exception: deleting all tracks and
    // re-creating must be atomic so the playlist is never half-populated.
    await prisma.$transaction([
      prisma.track.deleteMany({ where: { playlistId } }),
      prisma.track.createMany({
        data: tracks.map((t, position) => ({ ...t, playlistId, position })),
      }),
    ])
  },

  async updateMetadata(
    id: string,
    input: Omit<UpdatePlaylistInput, 'tracks'>
  ): Promise<Playlist> {
    const row = await prisma.playlist.update({
      where: { id },
      data: input,
      include: { tracks: { orderBy: { position: 'asc' } } },
    })
    return playlistFromPrisma(row)
  },

  async delete(id: string): Promise<void> {
    await prisma.playlist.delete({ where: { id } })
  },

  // ───────────────────────────────────────────────────────────────────
  //  Search (public-only) — backing store for the Search module.
  //  Privacy gate: `isPublic: true` is hard-coded into the where clause.
  //  This is a deliberate repository-level decision: pushing the filter to
  //  the DB layer ensures the `count` is accurate and no private rows leak
  //  into the merge step. Mirrors the 404-not-leak pattern in
  //  `commentService.listForPlaylist` and `playlistService.getPublicById`.
  // ───────────────────────────────────────────────────────────────────

  async searchPublic(
    tokens: string[],
    take: number
  ): Promise<Playlist[]> {
    const rows = await prisma.playlist.findMany({
      where: {
        isPublic: true,
        AND: tokens.map((token) => ({
          title: { contains: token },
        })),
      },
      orderBy: { createdAt: 'desc' },
      include: { tracks: { orderBy: { position: 'asc' } } },
      take,
    })
    return rows.map(playlistFromPrisma)
  },

  countPublicSearch(tokens: string[]): Promise<number> {
    return prisma.playlist.count({
      where: {
        isPublic: true,
        AND: tokens.map((token) => ({
          title: { contains: token },
        })),
      },
    })
  },
}
