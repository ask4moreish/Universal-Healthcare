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
      </p>
      <button type='button' onClick={logout}>
        Log out
      </button>
    </main>
  )
}
