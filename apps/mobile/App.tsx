import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { AuthProvider, useAuth } from './src/hooks/useAuth'
import LoginScreen from './src/screens/LoginScreen'
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

function HomeScreen() {
  const { user, logout } = useAuth()

  return (
    <View style={styles.homeContainer}>
      <Text style={styles.welcomeTitle}>Welcome{user ? `, ${user.email}` : ''}</Text>
      <Text style={styles.welcomeRole}>
        Role: {user?.role ?? 'unknown'}
      </Text>
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
  splashContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
