import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { usePlaylistActions, usePlaylists } from '../hooks/usePlaylists'

export default function PlaylistsScreen() {
  const { data, loading, error, refresh } = usePlaylists()
  const actions = usePlaylistActions()

  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return
    setFormError(null)
    try {
      await actions.create({
        title: title.trim(),
        isPublic,
        tracks: [],
      })
      setTitle('')
      setIsPublic(false)
      setCreating(false)
      await refresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create playlist')
    }
  }, [title, isPublic, actions, refresh])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await actions.remove(id)
        setDeleteErrors((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        await refresh()
      } catch (err) {
        setDeleteErrors((prev) => ({
          ...prev,
          [id]: err instanceof Error ? err.message : 'Failed to delete playlist',
        }))
      }
    },
    [actions, refresh]
  )

  const renderItem = useCallback(
    ({ item }: { item: typeof data[number] }) => (
      <View style={styles.card}>
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View
              style={[
                styles.badge,
                item.isPublic ? styles.badgePublic : styles.badgePrivate,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  item.isPublic
                    ? styles.badgeTextPublic
                    : styles.badgeTextPrivate,
                ]}
              >
                {item.isPublic ? 'Public' : 'Private'}
              </Text>
            </View>
          </View>

          <Text style={styles.cardMeta}>
            {item.tracks.length}{' '}
            {item.tracks.length === 1 ? 'track' : 'tracks'} ·{' '}
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>

          {deleteErrors[item.id] && (
            <Text style={styles.errorText}>{deleteErrors[item.id]}</Text>
          )}
        </View>

        <Pressable
          onPress={() => handleDelete(item.id)}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.deleteButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Delete playlist ${item.title}`}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
    ),
    [handleDelete, deleteErrors]
  )

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator testID="loading-indicator" size="large" />
      </View>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          onPress={refresh}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Retry loading playlists"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  // ── OK ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Playlists</Text>
        <Pressable
          onPress={() => {
            setCreating((v) => !v)
            setFormError(null)
          }}
          style={({ pressed }) => [
            styles.createToggle,
            creating && styles.createToggleActive,
            pressed && !creating && styles.createTogglePressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={creating ? 'Cancel new playlist' : 'Create new playlist'}
        >
          <Text
            style={[
              styles.createToggleText,
              creating && styles.createToggleTextActive,
            ]}
          >
            {creating ? 'Cancel' : '+ New'}
          </Text>
        </Pressable>
      </View>

      {/* ── Create form ─────────────────────────────────────────────────── */}
      {creating && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Playlist title"
            placeholderTextColor="#9ca3af"
            maxLength={200}
            autoFocus
          />

          <Pressable
            onPress={() => setIsPublic((v) => !v)}
            style={styles.checkboxRow}
            accessibilityRole="checkbox"
            accessibilityLabel="Make playlist public"
            accessibilityState={{ checked: isPublic }}
          >
            <View
              style={[
                styles.checkbox,
                isPublic && styles.checkboxChecked,
              ]}
            >
              {isPublic && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Make this playlist public</Text>
          </Pressable>

          {formError && (
            <Text style={styles.errorText}>{formError}</Text>
          )}

          <Pressable
            onPress={handleCreate}
            disabled={actions.loading || !title.trim()}
            style={({ pressed }) => [
              styles.submitButton,
              (actions.loading || !title.trim()) && styles.submitButtonDisabled,
              pressed &&
                !actions.loading &&
                title.trim() &&
                styles.submitButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Create playlist"
            accessibilityState={{ disabled: actions.loading || !title.trim() }}
          >
            <Text style={styles.submitButtonText}>
              {actions.loading ? 'Creating…' : 'Create Playlist'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── List ────────────────────────────────────────────────────────── */}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No playlists yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first playlist to get started
            </Text>
          </View>
        }
        contentContainerStyle={data.length === 0 && styles.emptyContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  createToggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a7f37',
  },
  createToggleActive: {
    backgroundColor: '#e5e7eb',
  },
  createTogglePressed: {
    backgroundColor: '#157a31',
  },
  createToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  createToggleTextActive: {
    color: '#111',
  },

  // Form
  form: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1a7f37',
    borderColor: '#1a7f37',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  submitButton: {
    backgroundColor: '#1a7f37',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#d1d5db',
    opacity: 0.6,
  },
  submitButtonPressed: {
    backgroundColor: '#157a31',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
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
  cardMeta: {
    fontSize: 13,
    color: '#6b7280',
  },

  // Delete
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deleteButtonPressed: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },

  // Empty
  emptyContainer: {
    flex: 1,
  },
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

  // Shared
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 20,
  },
  errorText: {
    color: '#b00020',
    fontSize: 13,
    marginTop: 6,
  },

  // Error state
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1a7f37',
  },
  retryButtonPressed: {
    backgroundColor: '#157a31',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
})
