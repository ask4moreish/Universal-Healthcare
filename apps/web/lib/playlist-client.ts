import { apiFetch, authHeaders, ApiError } from './api-client'
import type {
  CreatePlaylistRequest,
  ListPlaylistsResponse,
  PlaylistResponse,
  UpdatePlaylistRequest,
} from '@universal-healthcare/shared'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

// ─────────────────────────────────────────────────────────────────────────────
//  Public endpoints — no auth required.
// ─────────────────────────────────────────────────────────────────────────────

export function getPublicPlaylist(
  id: string
): Promise<{ data: PlaylistResponse }> {
  return apiFetch<{ data: PlaylistResponse }>(
    `/api/playlists/public/${encodeURIComponent(id)}`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Authenticated endpoints — require a Bearer token.
// ─────────────────────────────────────────────────────────────────────────────

export function listMyPlaylists(
  token: string
): Promise<ListPlaylistsResponse> {
  return apiFetch<ListPlaylistsResponse>('/api/playlists', {
    headers: authHeaders(token),
  })
}

export function getMyPlaylist(
  token: string,
  id: string
): Promise<{ data: PlaylistResponse }> {
  return apiFetch<{ data: PlaylistResponse }>(
    `/api/playlists/${encodeURIComponent(id)}`,
    { headers: authHeaders(token) }
  )
}

export function createPlaylist(
  token: string,
  input: CreatePlaylistRequest
): Promise<{ data: PlaylistResponse }> {
  return apiFetch<{ data: PlaylistResponse }>('/api/playlists', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  })
}

export function updatePlaylist(
  token: string,
  id: string,
  input: UpdatePlaylistRequest
): Promise<{ data: PlaylistResponse }> {
  return apiFetch<{ data: PlaylistResponse }>(
    `/api/playlists/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    }
  )
}

// Manual fetch (not apiFetch) because DELETE returns 204 No Content and
// apiFetch unconditionally calls .json(). Matches the logoutUser pattern
// in lib/auth-client.ts.
export async function deletePlaylist(
  token: string,
  id: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/playlists/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(token),
      },
    }
  )
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data?.error?.message ?? 'Failed to delete playlist'
    throw new ApiError(response.status, message)
  }
}
