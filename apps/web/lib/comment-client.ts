import type {
  CommentResponse,
  CreateCommentRequest,
  ListCommentsResponse,
  UpdateCommentRequest,
} from '@universal-healthcare/shared'
import { apiFetch, authHeaders } from './api-client'

// Public list — anonymous-readable, but the token is still forwarded so the
// server can include personalization hooks (none today; future-proof).
export function listCommentsForPlaylist(
  token: string | null,
  playlistId: string,
  page: number,
  pageSize: number
): Promise<ListCommentsResponse> {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return apiFetch<ListCommentsResponse>(
    `/api/comments/playlists/${encodeURIComponent(playlistId)}?${qs.toString()}`,
    token ? { headers: authHeaders(token) } : {}
  )
}

// Public single-comment read. Service gates on parent playlist's `isPublic`,
// so a private playlist's comment is unreachable here.
export function getCommentById(
  token: string | null,
  id: string
): Promise<CommentResponse> {
  return apiFetch<CommentResponse>(
    `/api/comments/${encodeURIComponent(id)}`,
    token ? { headers: authHeaders(token) } : {}
  )
}

export function createComment(
  token: string,
  playlistId: string,
  input: CreateCommentRequest
): Promise<CommentResponse> {
  return apiFetch<CommentResponse>(
    `/api/comments/playlists/${encodeURIComponent(playlistId)}`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    }
  )
}

export function updateComment(
  token: string,
  id: string,
  input: UpdateCommentRequest
): Promise<CommentResponse> {
  return apiFetch<CommentResponse>(`/api/comments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  })
}

export async function deleteComment(token: string, id: string): Promise<void> {
  await apiFetch<void>(`/api/comments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}
