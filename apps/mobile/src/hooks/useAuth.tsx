import type {
  AuthUser,
  LoginInput,
  RegisterInput,
} from '@universal-healthcare/shared'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  loginUser,
  logoutUser,
  refreshTokens,
  registerUser,
} from '../services/auth-client'

const ACCESS_TOKEN_KEY = 'universal-healthcare.token'
const REFRESH_TOKEN_KEY = 'universal-healthcare.refreshToken'
const USER_KEY = 'universal-healthcare.user'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore persisted session on mount
  useEffect(() => {
    async function load() {
      try {
        const storedToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY)
        const storedRefresh = await AsyncStorage.getItem(REFRESH_TOKEN_KEY)
        const storedUser = await AsyncStorage.getItem(USER_KEY)

        if (storedToken && storedRefresh && storedUser) {
          setToken(storedToken)
          setRefreshToken(storedRefresh)
          setUser(JSON.parse(storedUser) as AuthUser)
        }
      } catch {
        // Silent — user will need to log in again
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const persist = useCallback(
    async (
      nextUser: AuthUser,
      nextToken: string,
      nextRefresh: string
    ) => {
      try {
        await Promise.all([
          AsyncStorage.setItem(ACCESS_TOKEN_KEY, nextToken),
          AsyncStorage.setItem(REFRESH_TOKEN_KEY, nextRefresh),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser)),
        ])
      } catch {
        // Silent — state is still held in memory
      }
      setUser(nextUser)
      setToken(nextToken)
      setRefreshToken(nextRefresh)
    },
    []
  )

  const login = useCallback(
    async (input: LoginInput) => {
      const result = await loginUser(input)
      await persist(
        result.user,
        result.tokens.accessToken,
        result.tokens.refreshToken
      )
    },
    [persist]
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const result = await registerUser(input)
      await persist(
        result.user,
        result.tokens.accessToken,
        result.tokens.refreshToken
      )
    },
    [persist]
  )

  const refresh = useCallback(async () => {
    if (!refreshToken) throw new Error('No refresh token')
    const result = await refreshTokens(refreshToken)
    await persist(
      result.user,
      result.tokens.accessToken,
      result.tokens.refreshToken
    )
  }, [refreshToken, persist])

  const logout = useCallback(async () => {
    try {
      await logoutUser(refreshToken ?? undefined)
    } finally {
      try {
        await Promise.all([
          AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
          AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
          AsyncStorage.removeItem(USER_KEY),
        ])
      } catch {
        // Silent
      }
      setUser(null)
      setToken(null)
      setRefreshToken(null)
    }
  }, [refreshToken])

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
