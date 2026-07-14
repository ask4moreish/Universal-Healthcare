import type { ListFollowsResponse } from '@universal-healthcare/shared'
import { apiFetch, authHeaders } from './api-client'

// Public reads — anonymous-browsable. The token is forwarded only if present
// so the server can include personalization hooks (none today; future-proof).
export function listUserFollowing(
  token: string | null,
  userId: string,
  page: number,
  pageSize: number
): Promise<ListFollowsResponse> {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return apiFetch<ListFollowsResponse>(
    `/api/follows/users/${encodeURIComponent(userId)}/following?${qs.toString()}`,
    token ? { headers: authHeaders(token) } : {}
  )
}

export function listUserFollowers(
  token: string | null,
  userId: string,
  page: number,
  pageSize: number
): Promise<ListFollowsResponse> {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return apiFetch<ListFollowsResponse>(
    `/api/follows/users/${encodeURIComponent(userId)}/followers?${qs.toString()}`,
    token ? { headers: authHeaders(token) } : {}
  )
}

// Authenticated "me" reads.
export function listMyFollowing(
  token: string,
  page: number,
  pageSize: number
): Promise<ListFollowsResponse> {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return apiFetch<ListFollowsResponse>(
    `/api/follows/me/following?${qs.toString()}`,
    { headers: authHeaders(token) }
  )
}

export function listMyFollowers(
  token: string,
  page: number,
  pageSize: number
): Promise<ListFollowsResponse> {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return apiFetch<ListFollowsResponse>(
    `/api/follows/me/followers?${qs.toString()}`,
    { headers: authHeaders(token) }
  )
}

export function followUser(
  token: string,
  followeeId: string
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(
    `/api/follows/me/following/${encodeURIComponent(followeeId)}`,
    { method: 'POST', headers: authHeaders(token) }
  )
}

export async function unfollowUser(
  token: string,
  followeeId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/follows/me/following/${encodeURIComponent(followeeId)}`,
    { method: 'DELETE', headers: authHeaders(token) }
  )
}
