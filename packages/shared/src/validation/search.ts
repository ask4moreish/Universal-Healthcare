import { z } from 'zod'
import { paginationSchema } from './pagination.js'

// ─────────────────────────────────────────────────────────────────────────────
//  Type-filter enum. Comma-separated list in the query string, parsed into
//  an array by the schema. New search targets (e.g. `track`) would extend
//  this enum AND add a corresponding case to `SearchHitType` in
//  `types/search.ts`.
// ─────────────────────────────────────────────────────────────────────────────

export const searchTypeSchema = z.enum(['creator', 'playlist', 'comment'])
export type SearchType = z.infer<typeof searchTypeSchema>

const SEARCH_QUERY_MAX = 200
const SEARCH_LIMIT_MAX = 50
const SEARCH_LIMIT_DEFAULT = 20

// ─────────────────────────────────────────────────────────────────────────────
//  Query-string schema for GET /api/search. The api's controller parses
//  `req.query` against this; a 400 is thrown on any failure (Zod's default
//  error path).
//
//  `page` and `pageSize` come from the shared `paginationSchema` so the
//  search endpoint is consistent with the rest of the api (creators list,
//  comments list, follows list, notifications list).
//
//  `limit` is a search-specific override: it caps how many results the
//  service returns AFTER the cross-entity merge + score + sort step. The
//  default is 20 (matches the default pageSize). Setting `limit` separately
//  lets the client ask for "give me the top 5 results regardless of
//  pagination" for an autocomplete dropdown, without having to thread
//  pageSize through.
// ─────────────────────────────────────────────────────────────────────────────

export const searchQuerySchema = paginationSchema.extend({
  q: z
    .string()
    .min(1, 'Search query is required')
    .max(
      SEARCH_QUERY_MAX,
      `Search query must be at most ${SEARCH_QUERY_MAX} characters`
    ),
  // `types=creator,playlist` (no whitespace). Unknown values fail the
  // `searchTypeSchema` enum and return 400.
  types: z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    )
    .pipe(z.array(searchTypeSchema).min(1))
    .optional(),
  limit: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(SEARCH_LIMIT_MAX, `limit must be at most ${SEARCH_LIMIT_MAX}`)
    .default(SEARCH_LIMIT_DEFAULT)
    .optional(),
})

export type SearchQuery = z.infer<typeof searchQuerySchema>
