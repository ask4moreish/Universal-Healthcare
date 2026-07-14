import type { CreatorProfile } from '../../creators/types/creator.types.js'
import type { Playlist } from '../../playlists/types/playlist.types.js'
import type { Comment } from '../../comments/types/comment.types.js'

// ─────────────────────────────────────────────────────────────────────────────
//  Internal search hit — the raw form the service computes scores against
//  BEFORE converting to the public DTO (`SearchHitResponse` in shared).
//  Carries the full DB row so the scoring function can read all fields,
//  and the matched-fields metadata for the DTO.
// ─────────────────────────────────────────────────────────────────────────────

export interface InternalSearchHitBase {
  score: number
  matchedFields: string[]
}

export type InternalSearchHit =
  | (InternalSearchHitBase & { type: 'creator'; row: CreatorProfile })
  | (InternalSearchHitBase & { type: 'playlist'; row: Playlist })
  | (InternalSearchHitBase & { type: 'comment'; row: Comment })
