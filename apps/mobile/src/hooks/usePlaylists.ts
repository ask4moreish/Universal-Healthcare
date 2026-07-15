import type {
  CreatePlaylistRequest,
  ListPlaylistsResponse,
  PlaylistResponse,
  UpdatePlaylistRequest,
} from '@universal-healthcare/shared'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../services/api-client'
import { useAuth } from './useAuth'

// ─────────────────────────────────────────────────────────────────────────────
//  Read hook — fetches the authenticated user's playlists (GET /api/playlists).
//  Returns an empty list when no token is present.
// ─────────────────────────────────────────────────────────────────────────────

interface UsePlaylistsResult {
  data: PlaylistResponse[]
  pagination: ListPlaylistsResponse['pagination'] | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const PAGE_SIZE = 20

export function usePlaylists(): UsePlaylistsResult {
  const { token } = useAuth()
  const [data, setData] = useState<PlaylistResponse[]>([])
  const [pagination, setPagination] = useState<
    ListPlaylistsResponse['pagination'] | null
  >(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      setData([])
      setPagination(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        page: '1',
        pageSize: String(PAGE_SIZE),
      })
      const result = await apiFetch<ListPlaylistsResponse>(
        `/api/playlists?${qs.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setData(result.data)
      setPagination(result.pagination)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load playlists'
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  return { data, pagination, loading, error, refresh: load }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Write hook — create, update, and delete playlists. All paths are
//  auth-gated server-side, so the hook throws if no token.
// ─────────────────────────────────────────────────────────────────────────────

interface UsePlaylistActionsResult {
  create: (input: CreatePlaylistRequest) => Promise<PlaylistResponse>
  update: (id: string, input: UpdatePlaylistRequest) => Promise<PlaylistResponse>
  remove: (id: string) => Promise<void>
  loading: boolean
  error: string | null
}

export function usePlaylistActions(): UsePlaylistActionsResult {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(
    async (input: CreatePlaylistRequest) => {
      if (!token) throw new ApiError(401, 'Not authenticated')
      setLoading(true)
      setError(null)
      try {
        const result = await apiFetch<{ data: PlaylistResponse }>(
          '/api/playlists',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(input),
          }
        )
        return result.data
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to create playlist'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  const update = useCallback(
    async (id: string, input: UpdatePlaylistRequest) => {
      if (!token) throw new ApiError(401, 'Not authenticated')
      setLoading(true)
      setError(null)
      try {
        const result = await apiFetch<{ data: PlaylistResponse }>(
          `/api/playlists/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(input),
          }
        )
        return result.data
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to update playlist'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  const remove = useCallback(
    async (id: string) => {
      if (!token) throw new ApiError(401, 'Not authenticated')
      setLoading(true)
      setError(null)
      try {
        await apiFetch<void>(`/api/playlists/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to delete playlist'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  return { create, update, remove, loading, error }
}
