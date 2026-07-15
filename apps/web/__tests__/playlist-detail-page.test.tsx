import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PlaylistDetailPage from '../app/playlists/[id]/page'

// ─────────────────────────────────────────────────────────────────────────────
//  Mock fixtures & stateful mock fns (hoisted so vi.mock can reference them).
// ─────────────────────────────────────────────────────────────────────────────

const mockPlaylist = (overrides?: Partial<{
  title: string
  isPublic: boolean
  tracks: Array<{
    id: string
    playlistId: string
    title: string
    artist: string
    duration: number
    position: number
    createdAt: string
    updatedAt: string
  }>
}>) => ({
  id: 'pl-1',
  userId: 'u-1',
  title: overrides?.title ?? 'My Mix Tape',
  isPublic: overrides?.isPublic ?? false,
  tracks: overrides?.tracks ?? [
    {
      id: 't-1',
      playlistId: 'pl-1',
      title: 'Sunrise',
      artist: 'Solar Vibes',
      duration: 192,
      position: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 't-2',
      playlistId: 'pl-1',
      title: 'Lagos Nights',
      artist: 'Buju',
      duration: 245,
      position: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const { mockGetMyPlaylist, mockGetPublicPlaylist, mockUpdatePlaylist, mockDeletePlaylist, mockRouterPush } = vi.hoisted(() => ({
  mockGetMyPlaylist: vi.fn(),
  mockGetPublicPlaylist: vi.fn(),
  mockUpdatePlaylist: vi.fn(),
  mockDeletePlaylist: vi.fn(),
  mockRouterPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'pl-1' }),
  useRouter: () => ({ push: mockRouterPush }),
}))

vi.mock('../lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ token: 'test-token', user: null, isLoading: false }),
}))

vi.mock('../lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
  apiFetch: vi.fn(),
  authHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
}))

vi.mock('../lib/auth-client', () => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  AuthApiError: class AuthApiError extends Error {},
}))

vi.mock('../lib/playlist-client', () => ({
  getMyPlaylist: (...args: unknown[]) => mockGetMyPlaylist(...args),
  getPublicPlaylist: (...args: unknown[]) => mockGetPublicPlaylist(...args),
  updatePlaylist: (...args: unknown[]) => mockUpdatePlaylist(...args),
  deletePlaylist: (...args: unknown[]) => mockDeletePlaylist(...args),
  createPlaylist: vi.fn(),
  listMyPlaylists: vi.fn(),
}))

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function renderPage() {
  return render(<PlaylistDetailPage />)
}

beforeEach(() => {
  mockGetMyPlaylist.mockReset()
  mockGetPublicPlaylist.mockReset()
  mockUpdatePlaylist.mockReset()
  mockDeletePlaylist.mockReset()
  mockRouterPush.mockReset()
  mockGetMyPlaylist.mockResolvedValue({ data: mockPlaylist() })
  mockUpdatePlaylist.mockImplementation(
    async (
      _token: unknown,
      _id: unknown,
      input: {
        tracks?: Array<{ title: string; artist: string; duration: number }>
      }
    ) => ({
      data: mockPlaylist({
        tracks:
          input.tracks?.map((t, i) => ({
            id: `t-existing-${i}`,
            playlistId: 'pl-1',
            title: t.title,
            artist: t.artist,
            duration: t.duration,
            position: i + 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          })) ?? [],
      }),
    })
  )
})

// ─────────────────────────────────────────────────────────────────────────────
//  Rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('PlaylistDetailPage', () => {
  it('renders the playlist title and tracks after loading', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'My Mix Tape' })).toBeInTheDocument()
    expect(screen.getByText('Sunrise')).toBeInTheDocument()
    expect(screen.getByText('Lagos Nights')).toBeInTheDocument()
    expect(screen.getByText('Solar Vibes')).toBeInTheDocument()
    expect(screen.getByText('Buju')).toBeInTheDocument()
  })

  it('shows the private badge for non-public playlists', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'My Mix Tape' })
    expect(screen.getByText('Private')).toBeInTheDocument()
  })

  it('shows the public badge when isPublic is true', async () => {
    mockGetMyPlaylist.mockResolvedValue({
      data: mockPlaylist({ title: 'Public Mix', isPublic: true }),
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Public Mix' })).toBeInTheDocument()
    expect(screen.getByText('Public')).toBeInTheDocument()
  })

  // ── Track editing mode ──────────────────────────────────────────────────

  it('exposes Edit Tracks and Edit and Delete buttons when logged in', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'My Mix Tape' })
    expect(screen.getByRole('button', { name: /edit tracks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('hides per-row remove buttons until Edit Tracks is clicked', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'My Mix Tape' })
    // No remove buttons initially.
    expect(screen.queryAllByLabelText(/remove track/i)).toHaveLength(0)

    await userEvent.setup().click(
      screen.getByRole('button', { name: /edit tracks/i })
    )

    expect(screen.getAllByLabelText(/remove track/i)).toHaveLength(2)
  })

  it('exits edit mode when Done is clicked', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { name: 'My Mix Tape' })
    await user.click(screen.getByRole('button', { name: /edit tracks/i }))
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /done/i }))
    expect(screen.queryByRole('button', { name: /done/i })).not.toBeInTheDocument()
    expect(screen.queryAllByLabelText(/remove track/i)).toHaveLength(0)
  })

  // ── Add track ──────────────────────────────────────────────────────────

  it('adds a track via the form and calls updatePlaylist with the appended track', async () => {
    const user = userEvent.setup()
    const onUpdate = mockUpdatePlaylist.mockImplementation(
      async (_token, _id, input: { tracks: Array<{ title: string; artist: string; duration: number }> }) => ({
        data: mockPlaylist({
          tracks: input.tracks.map((t, i) => ({
            id: `t-new-${i}`,
            playlistId: 'pl-1',
            title: t.title,
            artist: t.artist,
            duration: t.duration,
            position: i + 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          })),
        }),
      })
    )

    renderPage()
    await screen.findByRole('heading', { name: 'My Mix Tape' })
    await user.click(screen.getByRole('button', { name: /edit tracks/i }))
    await user.click(screen.getByRole('button', { name: /\+ add track/i }))

    await user.type(screen.getByLabelText(/title/i), 'New Banger')
    await user.type(screen.getByLabelText(/artist/i), 'Fresh Artist')
    await user.type(screen.getByLabelText(/duration/i), '180')

    await user.click(screen.getByRole('button', { name: /^add track$/i }))

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledTimes(1)
    })
    expect(onUpdate).toHaveBeenCalledWith(
      'test-token',
      'pl-1',
      expect.objectContaining({
        tracks: expect.arrayContaining([
          expect.objectContaining({ title: 'Sunrise' }),
          expect.objectContaining({ title: 'Lagos Nights' }),
          expect.objectContaining({
            title: 'New Banger',
            artist: 'Fresh Artist',
            duration: 180,
          }),
        ]),
      })
    )
    expect(await screen.findByText('New Banger')).toBeInTheDocument()
  })

  it('keeps the Add Track button disabled until all three fields are filled', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'My Mix Tape' })
    await user.click(screen.getByRole('button', { name: /edit tracks/i }))
    await user.click(screen.getByRole('button', { name: /\+ add track/i }))

    const addBtn = screen.getByRole('button', { name: /^add track$/i })
    expect(addBtn).toBeDisabled()

    await user.type(screen.getByLabelText(/title/i), 'Half')
    expect(addBtn).toBeDisabled()
    await user.type(screen.getByLabelText(/artist/i), 'Way')
    expect(addBtn).toBeDisabled()
    await user.type(screen.getByLabelText(/duration/i), '120')
    expect(addBtn).toBeEnabled()

    expect(mockUpdatePlaylist).not.toHaveBeenCalled()
  })

  it('shows an error alert when add track fails', async () => {
    const user = userEvent.setup()
    mockUpdatePlaylist.mockRejectedValueOnce(new Error('Server exploded'))

    renderPage()
    await screen.findByRole('heading', { name: 'My Mix Tape' })
    await user.click(screen.getByRole('button', { name: /edit tracks/i }))
    await user.click(screen.getByRole('button', { name: /\+ add track/i }))

    await user.type(screen.getByLabelText(/title/i), 'Err')
    await user.type(screen.getByLabelText(/artist/i), 'Or')
    await user.type(screen.getByLabelText(/duration/i), '60')
    await user.click(screen.getByRole('button', { name: /^add track$/i }))

    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
  })

  // ── Remove track ───────────────────────────────────────────────────────

  it('removes a track via its row button and calls updatePlaylist without that track', async () => {
    const user = userEvent.setup()
    const onUpdate = mockUpdatePlaylist.mockImplementation(
      async (_token, _id, input: { tracks: Array<{ title: string; artist: string; duration: number }> }) => ({
        data: mockPlaylist({
          tracks: input.tracks.map((t, i) => ({
            id: `t-keep-${i}`,
            playlistId: 'pl-1',
            title: t.title,
            artist: t.artist,
            duration: t.duration,
            position: i + 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          })),
        }),
      })
    )

    renderPage()
    await screen.findByRole('heading', { name: 'My Mix Tape' })
    await user.click(screen.getByRole('button', { name: /edit tracks/i }))

    await user.click(
      screen.getByLabelText('Remove track Sunrise')
    )

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(onUpdate).toHaveBeenCalledWith(
      'test-token',
      'pl-1',
      expect.objectContaining({
        tracks: expect.arrayContaining([
          expect.objectContaining({ title: 'Lagos Nights', artist: 'Buju' }),
        ]),
      })
    )
    // The other track should still be in the list.
    expect(await screen.findByText('Lagos Nights')).toBeInTheDocument()
  })

  it('shows an error alert when remove track fails', async () => {
    const user = userEvent.setup()
    mockUpdatePlaylist.mockRejectedValueOnce(new Error('Nope'))

    renderPage()
    await screen.findByRole('heading', { name: 'My Mix Tape' })
    await user.click(screen.getByRole('button', { name: /edit tracks/i }))

    await user.click(screen.getByLabelText('Remove track Sunrise'))

    expect(await screen.findByText('Nope')).toBeInTheDocument()
    // Track should remain after failure.
    expect(screen.getByText('Sunrise')).toBeInTheDocument()
  })

  // ── Delete playlist (smoke) ────────────────────────────────────────────

  it('requires two-step confirm before deleting the playlist', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { name: 'My Mix Tape' })
    expect(mockRouterPush).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => expect(mockDeletePlaylist).toHaveBeenCalledWith('test-token', 'pl-1'))
    expect(mockRouterPush).toHaveBeenCalledWith('/playlists')
  })
})
