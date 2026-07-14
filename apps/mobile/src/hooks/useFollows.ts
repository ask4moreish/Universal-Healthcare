import type {
  FollowResponse,
  ListFollowsResponse,
} from '@universal-healthcare/shared'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../services/api-client'
import { useAuth } from './useAuth'

type Scope = 'following' | 'followers'

interface UseFollowsResult {
  data: FollowResponse[]
  pagination: ListFollowsResponse['pagination'] | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const PAGE_SIZE = 20

// Reads a user's followers or following list. When `userId` is null the
// hook resolves to the authenticated user's own list (the API's `/me/…`
// endpoints). Public reads still forward the token if present.
export function useFollows(
  userId: string | null,
  scope: Scope
): UseFollowsResult {
  const { token } = useAuth()
  const [data, setData] = useState<FollowResponse[]>([])
  const [pagination, setPagination] = useState<
    ListFollowsResponse['pagination'] | null
  >(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        page: '1',
        pageSize: String(PAGE_SIZE),
      })
      const base = userId
        ? `/api/follows/users/${encodeURIComponent(userId)}/${scope}`
        : `/api/follows/me/${scope}`
      const result = await apiFetch<ListFollowsResponse>(
        `${base}?${qs.toString()}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      )
      setData(result.data)
      setPagination(result.pagination)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load follows')
    } finally {
      setLoading(false)
    }
  }, [userId, scope, token])

  useEffect(() => {
    load()
  }, [load])

  return { data, pagination, loading, error, refresh: load }
}

interface UseFollowActionsResult {
  follow: (followeeId: string) => Promise<{ id: string }>
  unfollow: (followeeId: string) => Promise<void>
  loading: boolean
  error: string | null
}

// All write paths are auth-gated server-side, so the hook throws if no token.
// Maps P2002 / "ALREADY_FOLLOWING" 409 — caller is expected to refresh after
// unfollow failures.
export function useFollowActions(): UseFollowActionsResult {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const follow = useCallback(
    async (followeeId: string) => {
      if (!token) throw new ApiError(401, 'Not authenticated')
      setLoading(true)
      setError(null)
      try {
        return await apiFetch<{ id: string }>(
          `/api/follows/me/following/${encodeURIComponent(followeeId)}`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
        )
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to follow user'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  const unfollow = useCallback(
    async (followeeId: string) => {
      if (!token) throw new ApiError(401, 'Not authenticated')
      setLoading(true)
      setError(null)
      try {
        await apiFetch<void>(
          `/api/follows/me/following/${encodeURIComponent(followeeId)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
        )
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to unfollow user'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  return { follow, unfollow, loading, error }
}
