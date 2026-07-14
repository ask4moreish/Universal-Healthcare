import type { SearchHitType, SearchResponse } from '@universal-healthcare/shared'
import { apiFetch, authHeaders } from './api-client'

export interface SearchOptions {
  q: string
  page?: number
  pageSize?: number
  /** Comma-separated list — e.g. `['creator', 'playlist']`. Omit to search all. */
  types?: SearchHitType[]
  /** Cap on results returned per request. Defaults to pageSize. */
  limit?: number
}

// Public endpoint — no requireAuth on the api. The token is forwarded when
// present so the server can include personalization hooks (none today;
// future-proof).
export function search(
  token: string | null,
  opts: SearchOptions
): Promise<SearchResponse> {
  const qs = new URLSearchParams({ q: opts.q })
  if (opts.page !== undefined) qs.set('page', String(opts.page))
  if (opts.pageSize !== undefined) qs.set('pageSize', String(opts.pageSize))
  if (opts.types !== undefined) qs.set('types', opts.types.join(','))
  if (opts.limit !== undefined) qs.set('limit', String(opts.limit))
  return apiFetch<SearchResponse>(
    `/api/search?${qs.toString()}`,
    token ? { headers: authHeaders(token) } : {}
  )
}
