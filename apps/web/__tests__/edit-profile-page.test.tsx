import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MeResponse } from '@universal-healthcare/shared'
import { describe, expect, it, vi } from 'vitest'
import EditProfilePage from '../app/profile/edit/page'

// ─────────────────────────────────────────────────────────────────────────────
//  Mock fixtures
// ─────────────────────────────────────────────────────────────────────────────

const defaultMeProfile = {
  creatorProfile: {
    id: 'cp-1',
    userId: 'u-1',
    displayName: 'Solar Vibes',
    slug: 'solar-vibes',
    bio: 'Indie vibes',
    avatarUrl: null,
    genre: 'Indie',
    location: 'Lagos',
    isVerified: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  fanProfile: {
    id: 'fp-1',
    userId: 'u-1',
    displayName: 'Solar Vibes',
    avatarUrl: null,
    genrePrefs: ['jazz', 'lo-fi'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
}

// Default user used when callers don't override individual fields. Includes
// BOTH profiles so the existing pre-fill-assertion tests still pass without
// each test re-supplying them.
const defaultMeUser = {
  id: 'u-1',
  email: 'solar@test.com',
  creatorProfile: defaultMeProfile.creatorProfile,
  fanProfile: defaultMeProfile.fanProfile,
}

// Spread defaults first, then overrides so callers can pass `null`
// explicitly without it being silently coerced back to the default.
const mockMeResponse = (
  overrides?: Partial<{
    creatorProfile: typeof defaultMeProfile.creatorProfile | null
    fanProfile: typeof defaultMeProfile.fanProfile | null
  }>
): MeResponse => ({
  user: {
    ...defaultMeUser,
    ...overrides,
  },
})

// Hoisted so vi.mock factories can reference them.
const { mockGetMe, mockUpdateMe, mockUseAuth } = vi.hoisted(() => ({
  mockGetMe: vi.fn(),
  mockUpdateMe: vi.fn(),
  mockUseAuth: vi.fn(),
}))

// ─────────────────────────────────────────────────────────────────────────────
//  Module mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../lib/user-client', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
  updateMe: (...args: unknown[]) => mockUpdateMe(...args),
}))

vi.mock('../lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockUseAuth(),
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

// ─────────────────────────────────────────────────────────────────────────────
//  Defaults & helpers
// ─────────────────────────────────────────────────────────────────────────────

function setAuth(overrides?: Partial<{ token: string | null }>) {
  // Use explicit `in` check so callers can pass `token: null` without it
  // being silently coerced by the default.
  mockUseAuth.mockReturnValue({
    token:
      overrides && 'token' in overrides ? overrides.token : 'test-token',
    user: null,
    isLoading: false,
  })
}

beforeEach(() => {
  mockGetMe.mockReset()
  mockUpdateMe.mockReset()
  mockUseAuth.mockReset()
  setAuth()
  mockGetMe.mockResolvedValue(mockMeResponse())
  mockUpdateMe.mockResolvedValue({ ok: true })
})

// ─────────────────────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('EditProfilePage', () => {
  // ── Happy path (existing tests) ───────────────────────────────────────

  it('renders the edit form with pre-filled values', async () => {
    render(<EditProfilePage />)

    expect(await screen.findByLabelText(/display name/i)).toHaveValue(
      'Solar Vibes'
    )
    expect(screen.getByLabelText(/bio/i)).toHaveValue('Indie vibes')
    expect(screen.getByLabelText(/^genre$/i)).toHaveValue('Indie')
    expect(screen.getByLabelText(/location/i)).toHaveValue('Lagos')
    expect(screen.getByLabelText(/genre preferences/i)).toHaveValue(
      'jazz, lo-fi'
    )
  })

  it('submits valid data and shows success message', async () => {
    const user = userEvent.setup()
    render(<EditProfilePage />)

    const bioField = await screen.findByLabelText(/bio/i)
    await user.clear(bioField)
    await user.type(bioField, 'Updated bio')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(
      await screen.findByText(/profile updated successfully/i)
    ).toBeInTheDocument()
    expect(mockUpdateMe).toHaveBeenCalledWith(
      'test-token',
      expect.objectContaining({ bio: 'Updated bio' })
    )
  })

  it('shows validation error for a display name that is too short', async () => {
    const user = userEvent.setup()
    render(<EditProfilePage />)

    const nameField = await screen.findByLabelText(/display name/i)
    await user.clear(nameField)
    await user.type(nameField, 'X')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  // ── Auth gate ──────────────────────────────────────────────────────────

  it('prompts the user to log in when there is no token', async () => {
    setAuth({ token: null })

    render(<EditProfilePage />)

    expect(
      await screen.findByText(/please log in/i)
    ).toBeInTheDocument()
    // getMe must not be invoked when there is no token.
    expect(mockGetMe).not.toHaveBeenCalled()
  })

  // ── Loading state ──────────────────────────────────────────────────────

  it('shows Loading… until the profile fetch resolves', async () => {
    let resolveFetch!: (value: MeResponse) => void
    mockGetMe.mockImplementation(
      () =>
        new Promise<MeResponse>((resolve) => {
          resolveFetch = resolve
        })
    )

    render(<EditProfilePage />)

    // Initial render returns the Loading… state synchronously.
    expect(screen.getByText('Loading…')).toBeInTheDocument()

    resolveFetch(mockMeResponse())
    expect(await screen.findByLabelText(/display name/i)).toBeInTheDocument()
  })

  // ── Error state ────────────────────────────────────────────────────────

  it('renders the load-error alert when getMe rejects', async () => {
    mockGetMe.mockRejectedValueOnce(new Error('boom'))

    render(<EditProfilePage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Failed to load profile')
  })

  // ── Partial profile fallback ──────────────────────────────────────────

  it('pre-fills from creatorProfile when fanProfile is missing', async () => {
    mockGetMe.mockResolvedValueOnce(
      mockMeResponse({
        fanProfile: null,
      })
    )

    render(<EditProfilePage />)

    expect(await screen.findByLabelText(/display name/i)).toHaveValue(
      'Solar Vibes'
    )
    expect(screen.getByLabelText(/bio/i)).toHaveValue('Indie vibes')
    expect(screen.getByLabelText(/^genre$/i)).toHaveValue('Indie')
    expect(screen.getByLabelText(/location/i)).toHaveValue('Lagos')
    // Genre preferences come from fanProfile; should be empty when absent.
    expect(screen.getByLabelText(/genre preferences/i)).toHaveValue('')
  })

  it('pre-fills from fanProfile when creatorProfile is missing', async () => {
    mockGetMe.mockResolvedValueOnce(
      mockMeResponse({
        creatorProfile: null,
        fanProfile: {
          ...defaultMeProfile.fanProfile,
          displayName: 'Fan Name',
          genrePrefs: ['ambient', 'techno'],
        },
      })
    )

    render(<EditProfilePage />)

    expect(await screen.findByLabelText(/display name/i)).toHaveValue(
      'Fan Name'
    )
    // Creator-specific fields should be empty when creatorProfile is absent.
    expect(screen.getByLabelText(/bio/i)).toHaveValue('')
    expect(screen.getByLabelText(/^genre$/i)).toHaveValue('')
    expect(screen.getByLabelText(/location/i)).toHaveValue('')
    expect(screen.getByLabelText(/genre preferences/i)).toHaveValue(
      'ambient, techno'
    )
  })

  it('renders empty form fields when both profiles are missing', async () => {
    mockGetMe.mockResolvedValueOnce(
      mockMeResponse({
        creatorProfile: null,
        fanProfile: null,
      })
    )

    render(<EditProfilePage />)

    expect(await screen.findByLabelText(/display name/i)).toHaveValue('')
    expect(screen.getByLabelText(/bio/i)).toHaveValue('')
    expect(screen.getByLabelText(/^genre$/i)).toHaveValue('')
    expect(screen.getByLabelText(/location/i)).toHaveValue('')
    expect(screen.getByLabelText(/genre preferences/i)).toHaveValue('')
  })

  // ── Param passthrough ──────────────────────────────────────────────────

  it('calls getMe with the current auth token', async () => {
    setAuth({ token: 'other-token-abc' })

    render(<EditProfilePage />)

    await screen.findByLabelText(/display name/i)

    expect(mockGetMe).toHaveBeenCalledWith('other-token-abc')
  })
})
