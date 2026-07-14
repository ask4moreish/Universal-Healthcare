import type {
  CommentResponse,
  CreateCommentRequest,
  ListCommentsResponse,
  UpdateCommentRequest,
} from '@universal-healthcare/shared'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../services/api-client'
import { useAuth } from './useAuth'

interface UseCommentsResult {
  data: CommentResponse[]
  pagination: ListCommentsResponse['pagination'] | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const PAGE_SIZE = 20

// Anonymous-readable list of comments for a single playlist. The token is
// forwarded if present so the server can include personalization hooks.
export function useCommentsForPlaylist(
  playlistId: string | null
): UseCommentsResult {
  const { token } = useAuth()
  const [data, setData] = useState<CommentResponse[]>([])
  const [pagination, setPagination] = useState<
    ListCommentsResponse['pagination'] | null
  >(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!playlistId) {
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
      const result = await apiFetch<ListCommentsResponse>(
        `/api/comments/playlists/${encodeURIComponent(playlistId)}?${qs.toString()}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      )
      setData(result.data)
      setPagination(result.pagination)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load comments'
      )
    } finally {
      setLoading(false)
    }
  }, [playlistId, token])

  useEffect(() => {
    load()
  }, [load])

  return { data, pagination, loading, error, refresh: load }
}

interface UseCommentActionsResult {
  create: (
    playlistId: string,
    input: CreateCommentRequest
  ) => Promise<CommentResponse>
  update: (id: string, input: UpdateCommentRequest) => Promise<CommentResponse>
  remove: (id: string) => Promise<void>
  loading: boolean
  error: string | null
}

// All write paths are auth-gated server-side, so the hook throws if no token.
export function useCommentActions(): UseCommentActionsResult {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(
    async (playlistId: string, input: CreateCommentRequest) => {
      if (!token) throw new ApiError(401, 'Not authenticated')
      setLoading(true)
      setError(null)
      try {
        return await apiFetch<CommentResponse>(
          `/api/comments/playlists/${encodeURIComponent(playlistId)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(input),
          }
        )
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to create comment'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  const update = useCallback(
    async (id: string, input: UpdateCommentRequest) => {
      if (!token) throw new ApiError(401, 'Not authenticated')
      setLoading(true)
      setError(null)
      try {
        return await apiFetch<CommentResponse>(
          `/api/comments/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(input),
          }
        )
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to update comment'
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
        await apiFetch<void>(`/api/comments/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to delete comment'
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
