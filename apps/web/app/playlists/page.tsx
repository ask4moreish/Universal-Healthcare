'use client'

import type { PlaylistResponse } from '@universal-healthcare/shared'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { createPlaylist, deletePlaylist, listMyPlaylists } from '../../lib/playlist-client'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; playlists: PlaylistResponse[] }

export default function PlaylistsPage() {
  const { token, isLoading: authLoading } = useAuth()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!token) {
      setState({ status: 'loading' })
      return
    }
    try {
      const result = await listMyPlaylists(token)
      setState({ status: 'ok', playlists: result.data })
    } catch {
      setState({ status: 'error', message: 'Failed to load playlists' })
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!token || !title.trim()) return
      setSubmitting(true)
      setFormError(null)
      try {
        await createPlaylist(token, {
          title: title.trim(),
          isPublic,
          tracks: [],
        })
        setTitle('')
        setIsPublic(false)
        setCreating(false)
        await load()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to create playlist')
      } finally {
        setSubmitting(false)
      }
    },
    [token, title, isPublic, load]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      if (!token) return
      try {
        await deletePlaylist(token, id)
        setDeleteErrors((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        await load()
      } catch (err) {
        setDeleteErrors((prev) => ({
          ...prev,
          [id]: err instanceof Error ? err.message : 'Failed to delete playlist',
        }))
      }
    },
    [token, load]
  )

  // ── Auth loading (prevent flash) ──────────────────────────────────────
  if (authLoading) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    )
  }

  // ── Unauthenticated ────────────────────────────────────────────────────
  if (!token) {
    return (
      <main>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>
          My Playlists
        </h1>
        <p style={{ color: 'var(--muted, #6b7280)' }}>
          Please log in to view your playlists.
        </p>
      </main>
    )
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <main>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>
          My Playlists
        </h1>
        <p style={{ color: 'var(--muted, #6b7280)' }}>Loading…</p>
      </main>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <main>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>
          My Playlists
        </h1>
        <p role="alert">{state.message}</p>
        <button
          type="button"
          onClick={load}
          style={{ marginTop: '0.75rem' }}
        >
          Retry
        </button>
      </main>
    )
  }

  // ── OK: render the list ─────────────────────────────────────────────────
  const { playlists } = state

  return (
    <main>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>My Playlists</h1>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: '0.5rem',
            border: 'none',
            background: creating ? 'var(--muted, #e5e7eb)' : '#1a7f37',
            color: creating ? '#111' : '#fff',
            cursor: 'pointer',
            transition: 'background 0.15s, transform 0.1s',
          }}
          onMouseEnter={(e) => {
            if (!creating) (e.currentTarget.style.background = '#157a31')
          }}
          onMouseLeave={(e) => {
            if (!creating) (e.currentTarget.style.background = '#1a7f37')
          }}
        >
          {creating ? 'Cancel' : '+ New Playlist'}
        </button>
      </div>

      {/* ── Create form ─────────────────────────────────────────────────── */}
      {creating && (
        <form
          onSubmit={handleCreate}
          style={{
            background: 'var(--card-bg, #f9fafb)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div>
            <label htmlFor="playlist-title">Title</label>
            <input
              id="playlist-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My awesome playlist"
              required
              maxLength={200}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                border: '1px solid var(--border, #d1d5db)',
                borderRadius: '0.5rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 400,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              style={{ width: 'auto', cursor: 'pointer' }}
            />
            Make this playlist public
          </label>

          {formError && <p role="alert">{formError}</p>}

          <button
            type="submit"
            disabled={submitting || !title.trim()}
            style={{
              alignSelf: 'flex-start',
              padding: '0.5rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              borderRadius: '0.5rem',
              border: 'none',
              background:
                submitting || !title.trim()
                  ? 'var(--muted, #d1d5db)'
                  : '#1a7f37',
              color: '#fff',
              cursor:
                submitting || !title.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              opacity: submitting || !title.trim() ? 0.6 : 1,
            }}
          >
            {submitting ? 'Creating…' : 'Create Playlist'}
          </button>
        </form>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {playlists.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: 'var(--muted, #9ca3af)',
          }}
        >
          <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
            No playlists yet
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Create your first playlist to get started
          </p>
        </div>
      )}

      {/* ── Playlist cards ──────────────────────────────────────────────── */}
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {playlists.map((pl) => (
          <li
            key={pl.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              background: 'var(--card-bg, #f9fafb)',
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: '0.75rem',
              transition: 'box-shadow 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow =
                '0 2px 8px rgba(0,0,0,0.06)'
              e.currentTarget.style.borderColor =
                'var(--accent, #2563eb)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderColor =
                'var(--border, #e5e7eb)'
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.25rem',
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '1.0625rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pl.title}
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    padding: '0.125rem 0.5rem',
                    borderRadius: '999px',
                    background: pl.isPublic
                      ? '#d1fae5'
                      : 'var(--muted, #e5e7eb)',
                    color: pl.isPublic ? '#065f46' : '#6b7280',
                    flexShrink: 0,
                  }}
                >
                  {pl.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--muted, #6b7280)',
                  display: 'flex',
                  gap: '1rem',
                }}
              >
                <span>
                  {pl.tracks.length}{' '}
                  {pl.tracks.length === 1 ? 'track' : 'tracks'}
                </span>
                <span>
                  {new Date(pl.createdAt).toLocaleDateString()}
                </span>
              </div>
              {deleteErrors[pl.id] && (
                <p role="alert" style={{ marginTop: '0.375rem', fontSize: '0.8125rem' }}>
                  {deleteErrors[pl.id]}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleDelete(pl.id)}
              title="Delete playlist"
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderRadius: '0.5rem',
                border: '1px solid transparent',
                background: 'transparent',
                color: 'var(--muted, #6b7280)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#b00020'
                e.currentTarget.style.borderColor = '#fecaca'
                e.currentTarget.style.background = '#fef2f2'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--muted, #6b7280)'
                e.currentTarget.style.borderColor = 'transparent'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
