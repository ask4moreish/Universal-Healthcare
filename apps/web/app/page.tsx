'use client'

import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

export default function HomePage() {
  const { user, isLoading, logout } = useAuth()

  if (isLoading) {
    return (
      <main>
        <p>Loading...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main>
        <h1>Universal Healthcare Data Network</h1>
        <p>
          <Link href='/login'>Log in</Link> or{' '}
          <Link href='/register'>create an account</Link> to get started.
        </p>
      </main>
    )
  }

  return (
    <main>
      <h1>Universal Healthcare Data Network</h1>
      <p>You are logged in as {user.email}.</p>
      <p>
        <Link
          href='/playlists'
          style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            background: '#1a7f37',
            color: '#fff',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            marginRight: '0.5rem',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = '#157a31'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = '#1a7f37'
          }}
        >
          My Playlists
        </Link>
        <Link
          href='/profile/edit'
          style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            border: '1px solid var(--border, #d1d5db)',
            color: 'var(--muted, #6b7280)',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLAnchorElement
            el.style.borderColor = '#2563eb'
            el.style.color = '#2563eb'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLAnchorElement
            el.style.borderColor = 'var(--border, #d1d5db)'
            el.style.color = 'var(--muted, #6b7280)'
          }}
        >
          Profile
        </Link>
      </p>
      <button type='button' onClick={logout}>
        Log out
      </button>
    </main>
  )
}
