'use client'

import type { PlaylistResponse, TrackResponse } from '@universal-healthcare/shared'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../lib/auth-context'
import { getMyPlaylist, getPublicPlaylist } from '../../../lib/playlist-client'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; playlist: PlaylistResponse }

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface TrackRowProps {
  track: TrackResponse
  position: number
}

function TrackRow({ track, position }: TrackRowProps) {
  return (
    <tr
      style={{
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--hover-bg, #f3f4f6)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <td
        style={{
          padding: '0.625rem 0.75rem',
          fontSize: '0.8125rem',
          color: 'var(--muted, #9ca3af)',
          textAlign: 'right',
          width: '2rem',
        }}
      >
        {position}
      </td>
      <td style={{ padding: '0.625rem 0.75rem' }}>
        <span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>
          {track.title}
        </span>
      </td>
      <td
        style={{
          padding: '0.625rem 0.75rem',
          fontSize: '0.875rem',
          color: 'var(--muted, #6b7280)',
        }}
      >
        {track.artist}
      </td>
      <td
        style={{
          padding: '0.625rem 0.75rem',
          fontSize: '0.8125rem',
          color: 'var(--muted, #9ca3af)',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatDuration(track.duration)}
      </td>
    </tr>
  )
}

export default function PlaylistDetailPage() {
  const params = useParams<{ id: string }>()
  const { token } = useAuth()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    try {
      // Try auth endpoint first (owner gets private playlists),
      // fall back to public endpoint for anonymous / non-owner viewers.
      if (token) {
        try {
          const result = await getMyPlaylist(token, params.id)
          setState({ status: 'ok', playlist: result.data })
          return
        } catch (err) {
          // If 404 (private or not found), try public endpoint below.
          const status = (err as { status?: number }).status
          if (status !== 404) throw err
        }
      }
      const result = await getPublicPlaylist(params.id)
      setState({ status: 'ok', playlist: result.data })
    } catch {
      setState({ status: 'error', message: 'Playlist not found' })
    }
  }, [params.id, token])

  useEffect(() => {
    load()
  }, [load])

  // ── Loading ─────────────────────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <main>
        <p style={{ color: 'var(--muted, #6b7280)' }}>Loading…</p>
      </main>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <main>
        <Link
          href="/playlists"
          style={{
            display: 'inline-block',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            color: '#2563eb',
            textDecoration: 'none',
          }}
        >
          ← Back to playlists
        </Link>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
          Not Found
        </h1>
        <p>{state.message}</p>
      </main>
    )
  }

  // ── OK ──────────────────────────────────────────────────────────────────
  const { playlist } = state

  return (
    <main>
      <Link
        href="/playlists"
        style={{
          display: 'inline-block',
          marginBottom: '1.25rem',
          fontSize: '0.875rem',
          color: '#2563eb',
          textDecoration: 'none',
        }}
      >
        ← Back to playlists
      </Link>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.5rem',
        }}
      >
        <h1
          style={{
            fontSize: '1.75rem',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {playlist.title}
        </h1>
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 500,
            padding: '0.125rem 0.5rem',
            borderRadius: '999px',
            background: playlist.isPublic ? '#d1fae5' : 'var(--muted, #e5e7eb)',
            color: playlist.isPublic ? '#065f46' : '#6b7280',
            flexShrink: 0,
          }}
        >
          {playlist.isPublic ? 'Public' : 'Private'}
        </span>
      </div>

      <div
        style={{
          fontSize: '0.8125rem',
          color: 'var(--muted, #6b7280)',
          marginBottom: '1.5rem',
        }}
      >
        {playlist.tracks.length}{' '}
        {playlist.tracks.length === 1 ? 'track' : 'tracks'} · Created{' '}
        {new Date(playlist.createdAt).toLocaleDateString()}
      </div>

      {/* ── Track list ──────────────────────────────────────────────────── */}
      {playlist.tracks.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '2.5rem 1rem',
            color: 'var(--muted, #9ca3af)',
            border: '1px dashed var(--border, #e5e7eb)',
            borderRadius: '0.75rem',
          }}
        >
          <p style={{ fontSize: '1rem', margin: 0 }}>
            This playlist is empty
          </p>
          <p style={{ fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>
            Add tracks to get started
          </p>
        </div>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '2px solid var(--border, #e5e7eb)',
              }}
            >
              <th
                style={{
                  textAlign: 'right',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--muted, #9ca3af)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  width: '2rem',
                }}
              >
                #
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--muted, #9ca3af)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Title
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--muted, #9ca3af)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Artist
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--muted, #9ca3af)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {playlist.tracks.map((track, i) => (
              <TrackRow key={track.id} track={track} position={i + 1} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
