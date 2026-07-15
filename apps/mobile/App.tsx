import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { AuthProvider, useAuth } from './src/hooks/useAuth'
import LoginScreen from './src/screens/LoginScreen'
import PlaylistsScreen from './src/screens/PlaylistsScreen'
import RegisterScreen from './src/screens/RegisterScreen'

type AuthScreen = 'login' | 'register'

function AuthNavigator() {
  const [screen, setScreen] = useState<AuthScreen>('login')

  return (
    <View style={styles.authContainer}>
      {screen === 'login' ? <LoginScreen /> : <RegisterScreen />}

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>
          {screen === 'login'
            ? "Don't have an account?"
            : 'Already have an account?'}
        </Text>
        <Pressable
          onPress={() =>
            setScreen(screen === 'login' ? 'register' : 'login')
          }
          accessibilityRole='button'
          accessibilityLabel={
            screen === 'login' ? 'Go to register' : 'Go to login'
          }
        >
          <Text style={styles.switchLink}>
            {screen === 'login' ? 'Create one' : 'Log in'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

type AppRoute = 'home' | 'playlists'

function HomeScreen() {
  const { user, logout } = useAuth()
  const [route, setRoute] = useState<AppRoute>('home')

  if (route === 'playlists') {
    return (
      <View style={styles.screenContainer}>
        <Pressable
          onPress={() => setRoute('home')}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back to home"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <PlaylistsScreen />
      </View>
    )
  }

  return (
    <View style={styles.homeContainer}>
      <Text style={styles.welcomeTitle}>Welcome{user ? `, ${user.email}` : ''}</Text>
      <Text style={styles.welcomeRole}>
        Role: {user?.role ?? 'unknown'}
      </Text>
      <Pressable
        style={styles.navButton}
        onPress={() => setRoute('playlists')}
        accessibilityRole="button"
        accessibilityLabel="View my playlists"
      >
        <Text style={styles.navButtonText}>My Playlists</Text>
      </Pressable>
      <Pressable
        style={styles.logoutButton}
        onPress={logout}
        accessibilityRole='button'
        accessibilityLabel='Log out'
      >
        <Text style={styles.logoutButtonText}>Log out</Text>
      </Pressable>
      <StatusBar style='dark' />
    </View>
  )
}

function RootNavigator() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size='large' color='#1976d2' />
      </View>
    )
  }

  if (user) {
    return <HomeScreen />
  }

  return <AuthNavigator />
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  )
}

const styles = StyleSheet.create({
  authContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 40,
    gap: 6,
  },
  switchText: {
    fontSize: 14,
    color: '#666',
  },
  switchLink: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
  },
  homeContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeRole: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  logoutButton: {
    backgroundColor: '#d32f2f',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 32,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  navButton: {
    backgroundColor: '#1a7f37',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
    width: '100%',
    maxWidth: 280,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: '500',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
