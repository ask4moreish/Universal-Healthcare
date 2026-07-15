import { z } from 'zod'

const PLAYLIST_TITLE_MAX = 200
const TRACK_TITLE_MAX = 300
const ARTIST_NAME_MAX = 300
const DURATION_MAX = 86_400 // 24 hours in seconds — generous upper bound for any track
const TRACKS_MAX = 10_000 // per-playlist track limit

// ─────────────────────────────────────────────────────────────────────────────
//  Track input schema — used inside createPlaylistSchema and updatePlaylistSchema.
// ─────────────────────────────────────────────────────────────────────────────

export const createTrackSchema = z.object({
  title: z
    .string()
    .min(1, 'Track title is required')
    .max(
      TRACK_TITLE_MAX,
      `Track title must be at most ${TRACK_TITLE_MAX} characters`
    ),
  artist: z
    .string()
    .min(1, 'Artist name is required')
    .max(
      ARTIST_NAME_MAX,
      `Artist name must be at most ${ARTIST_NAME_MAX} characters`
    ),
  duration: z
    .number()
    .int()
    .min(1, 'Duration must be at least 1 second')
    .max(
      DURATION_MAX,
      `Duration must be at most ${DURATION_MAX} seconds`
    ),
})

// ─────────────────────────────────────────────────────────────────────────────
//  Body schemas for POST /api/playlists (create) and PUT /api/playlists/:id
//  (full replace). PATCH can reuse these with .partial() at the call site.
// ─────────────────────────────────────────────────────────────────────────────

export const createPlaylistSchema = z.object({
  title: z
    .string()
    .min(1, 'Playlist title is required')
    .max(
      PLAYLIST_TITLE_MAX,
      `Playlist title must be at most ${PLAYLIST_TITLE_MAX} characters`
    ),
  isPublic: z.boolean().optional().default(false),
  tracks: z
    .array(createTrackSchema)
    .max(
      TRACKS_MAX,
      `A playlist can have at most ${TRACKS_MAX} tracks`
    )
    .optional()
    .default([]),
})

export type CreatePlaylistBody = z.infer<typeof createPlaylistSchema>

export const updatePlaylistSchema = z.object({
  title: z
    .string()
    .min(1, 'Playlist title is required')
    .max(
      PLAYLIST_TITLE_MAX,
      `Playlist title must be at most ${PLAYLIST_TITLE_MAX} characters`
    )
    .optional(),
  isPublic: z.boolean().optional(),
  tracks: z
    .array(createTrackSchema)
    .max(
      TRACKS_MAX,
      `A playlist can have at most ${TRACKS_MAX} tracks`
    )
    .optional(),
})

export type UpdatePlaylistBody = z.infer<typeof updatePlaylistSchema>

// ─────────────────────────────────────────────────────────────────────────────
//  URL param schemas.
// ─────────────────────────────────────────────────────────────────────────────

export const playlistIdParamSchema = z.object({
  id: z.string().min(1),
})
