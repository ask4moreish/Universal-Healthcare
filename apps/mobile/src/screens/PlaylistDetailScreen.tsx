import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { PlaylistResponse, TrackResponse } from '@universal-healthcare/shared'
import { ApiError, apiFetch } from '../services/api-client'
import { useAuth } from '../hooks/useAuth'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; playlist: PlaylistResponse }

interface Props {
  playlistId: string
  onBack: () => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function TrackRow({ track, position }: { track: TrackResponse; position: number }) {
  return (
    <View style={styles.trackRow}>
      <Text style={styles.trackPosition}>{position}</Text>
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      <Text style={styles.trackDuration}>
        {formatDuration(track.duration)}
      </Text>
    </View>
  )
}

export default function PlaylistDetailScreen({ playlistId, onBack }: Props) {
  const { token } = useAuth()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    try {
      // Try auth endpoint first (owner sees private playlists),
      // fall back to public endpoint for anonymous / non-owner viewers.
      if (token) {
        try {
          const result = await apiFetch<{ data: PlaylistResponse }>(
            `/api/playlists/${encodeURIComponent(playlistId)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          setState({ status: 'ok', playlist: result.data })
          return
        } catch (err) {
          const status = err instanceof ApiError ? err.status : undefined
          if (status !== 404) throw err
        }
      }
      const result = await apiFetch<{ data: PlaylistResponse }>(
        `/api/playlists/public/${encodeURIComponent(playlistId)}`
      )
      setState({ status: 'ok', playlist: result.data })
    } catch {
      setState({ status: 'error', message: 'Playlist not found' })
    }
  }, [playlistId, token])

  useEffect(() => {
    load()
  }, [load])

  // ── Loading ─────────────────────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <View style={styles.screen}>
        <BackButton onPress={onBack} />
        <View style={styles.center}>
          <ActivityIndicator testID="loading-indicator" size="large" />
        </View>
      </View>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <View style={styles.screen}>
        <BackButton onPress={onBack} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Not Found</Text>
          <Text style={styles.errorText}>{state.message}</Text>
        </View>
      </View>
    )
  }

  // ── OK ──────────────────────────────────────────────────────────────────
  const { playlist } = state

  return (
    <View style={styles.screen}>
      <BackButton onPress={onBack} />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={styles.detailHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.heading} numberOfLines={1}>
            {playlist.title}
          </Text>
          <View
            style={[
              styles.badge,
              playlist.isPublic ? styles.badgePublic : styles.badgePrivate,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                playlist.isPublic
                  ? styles.badgeTextPublic
                  : styles.badgeTextPrivate,
              ]}
            >
              {playlist.isPublic ? 'Public' : 'Private'}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {playlist.tracks.length}{' '}
          {playlist.tracks.length === 1 ? 'track' : 'tracks'} · Created{' '}
          {new Date(playlist.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {/* ── Track list ────────────────────────────────────────────────── */}
      {playlist.tracks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>This playlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add tracks to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={playlist.tracks}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <TrackRow track={item} position={index + 1} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.trackList}
        />
      )}
    </View>
  )
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.backButton,
        pressed && styles.backButtonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Go back to playlists"
    >
      <Text style={styles.backButtonText}>← Back to playlists</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  // Back
  backButton: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: '500',
  },

  // Header
  detailHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#f3f4f6',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgePublic: {
    backgroundColor: '#d1fae5',
  },
  badgePrivate: {
    backgroundColor: '#e5e7eb',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  badgeTextPublic: {
    color: '#065f46',
  },
  badgeTextPrivate: {
    color: '#6b7280',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
  },

  // Track list
  trackList: {
    paddingVertical: 8,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  trackPosition: {
    width: 28,
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'right',
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
    marginRight: 12,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
  },
  trackArtist: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  trackDuration: {
    fontSize: 13,
    color: '#9ca3af',
    fontVariant: ['tabular-nums'],
  },

  // Empty
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 17,
    color: '#9ca3af',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },

  // Error
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  errorText: {
    color: '#6b7280',
    fontSize: 15,
  },

  // Separator
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 20,
  },
})
