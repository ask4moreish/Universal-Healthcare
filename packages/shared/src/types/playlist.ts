import type { PaginationMeta } from './pagination.js'

// ─────────────────────────────────────────────────────────────────────────────
//  Response shapes (sent by the api → web/mobile clients).
//  `*At` fields are ISO-8601 strings, never Date — clients deserialize manually.
// ─────────────────────────────────────────────────────────────────────────────

export interface TrackResponse {
  id: string
  playlistId: string
  title: string
  artist: string
  duration: number
  position: number
  createdAt: string
  updatedAt: string
}

export interface PlaylistResponse {
  id: string
  userId: string
  title: string
  isPublic: boolean
  tracks: TrackResponse[]
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
//  Request payloads (sent by web/mobile clients, parsed by the api).
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateTrackInput {
  title: string
  artist: string
  duration: number
}

export interface CreatePlaylistRequest {
  title: string
  isPublic?: boolean
  tracks?: CreateTrackInput[]
}

export interface UpdatePlaylistRequest {
  title?: string
  isPublic?: boolean
  tracks?: CreateTrackInput[]
}

// ─────────────────────────────────────────────────────────────────────────────
//  Paginated envelope used by GET /api/playlists.
// ─────────────────────────────────────────────────────────────────────────────

export interface ListPlaylistsResponse {
  data: PlaylistResponse[]
  pagination: PaginationMeta
}
