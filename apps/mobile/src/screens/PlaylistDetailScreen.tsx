import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { PlaylistResponse, TrackResponse } from '@universal-healthcare/shared'
import { ApiError, apiFetch } from '../services/api-client'
import { useAuth } from '../hooks/useAuth'
import { usePlaylistActions } from '../hooks/usePlaylists'

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

function TrackRow({
  track,
  position,
  onRemove,
  editing,
  removing,
  anyRemoving,
}: {
  track: TrackResponse
  position: number
  onRemove?: (id: string) => void
  editing?: boolean
  removing?: boolean
  anyRemoving?: boolean
}) {
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
      {editing && onRemove && (
        <Pressable
          onPress={() => onRemove(track.id)}
          disabled={removing || anyRemoving}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && !removing && !anyRemoving && styles.removeButtonPressed,
            (removing || anyRemoving) && styles.removeButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Remove track ${track.title}`}
        >
          {removing ? (
            <ActivityIndicator size="small" color="#b00020" />
          ) : (
            <Text style={styles.removeButtonText}>✕</Text>
          )}
        </Pressable>
      )}
    </View>
  )
}

export default function PlaylistDetailScreen({ playlistId, onBack }: Props) {
  const { token } = useAuth()
  const actions = usePlaylistActions()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const hasLoadedOnce = useRef(false)

  // Metadata editing state
  const [editingMeta, setEditingMeta] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editIsPublic, setEditIsPublic] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)

  // Delete state
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Track editing state
  const [editingTracks, setEditingTracks] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newArtist, setNewArtist] = useState('')
  const [newDuration, setNewDuration] = useState('')
  const [savingTracks, setSavingTracks] = useState(false)
  const [trackError, setTrackError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (state.status === 'ok' || state.status === 'error') {
      hasLoadedOnce.current = true
    }
  }, [state.status])

  const fetchPlaylist = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true)
      try {
        if (token) {
          try {
            const result = await apiFetch<{ data: PlaylistResponse }>(
              `/api/playlists/${encodeURIComponent(playlistId)}`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            setRefreshError(null)
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
        setRefreshError(null)
        setState({ status: 'ok', playlist: result.data })
      } catch {
        if (isRefresh) {
          setRefreshError('Failed to refresh playlist')
        } else {
          setState({ status: 'error', message: 'Playlist not found' })
        }
      } finally {
        if (isRefresh) setRefreshing(false)
      }
    },
    [playlistId, token]
  )

  const handleRefresh = useCallback(
    () => fetchPlaylist(true),
    [fetchPlaylist]
  )

  useEffect(() => {
    fetchPlaylist(false)
  }, [fetchPlaylist])

  // ── Delete handler ─────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await actions.remove(playlistId)
      onBack()
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete playlist'
      )
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }, [playlistId, actions, onBack])

  // ── Metadata editing handlers ───────────────────────────────────────

  const startEditingMeta = useCallback(() => {
    if (state.status !== 'ok') return
    setEditTitle(state.playlist.title)
    setEditIsPublic(state.playlist.isPublic)
    setMetaError(null)
    setDeleteConfirm(false)
    setEditingTracks(false)
    setShowAddForm(false)
    setEditingMeta(true)
  }, [state])

  const handleSaveMeta = useCallback(async () => {
    if (!editTitle.trim()) return
    setSavingMeta(true)
    setMetaError(null)
    try {
      const updated = await actions.update(playlistId, {
        title: editTitle.trim(),
        isPublic: editIsPublic,
      })
      setState({ status: 'ok', playlist: updated })
      setEditingMeta(false)
    } catch (err) {
      setMetaError(
        err instanceof Error ? err.message : 'Failed to save changes'
      )
    } finally {
      setSavingMeta(false)
    }
  }, [playlistId, actions, editTitle, editIsPublic])

  // ── Track editing handlers ───────────────────────────────────────────

  const handleAddTrack = useCallback(async () => {
    if (state.status !== 'ok') return
    const duration = parseInt(newDuration, 10)
    if (!newTitle.trim() || !newArtist.trim() || !duration) return
    setSavingTracks(true)
    setTrackError(null)
    try {
      const newTrack = {
        title: newTitle.trim(),
        artist: newArtist.trim(),
        duration,
      }
      const updated = await actions.update(playlistId, {
        tracks: [
          ...state.playlist.tracks.map((t) => ({
            title: t.title,
            artist: t.artist,
            duration: t.duration,
          })),
          newTrack,
        ],
      })
      setState({ status: 'ok', playlist: updated })
      setNewTitle('')
      setNewArtist('')
      setNewDuration('')
      setShowAddForm(false)
    } catch (err) {
      setTrackError(
        err instanceof Error ? err.message : 'Failed to add track'
      )
    } finally {
      setSavingTracks(false)
    }
  }, [state, playlistId, actions, newTitle, newArtist, newDuration])

  const handleRemoveTrack = useCallback(
    async (trackId: string) => {
      if (state.status !== 'ok') return
      setRemovingId(trackId)
      try {
        const updated = await actions.update(playlistId, {
          tracks: state.playlist.tracks
            .filter((t) => t.id !== trackId)
            .map((t) => ({
              title: t.title,
              artist: t.artist,
              duration: t.duration,
            })),
        })
        setState({ status: 'ok', playlist: updated })
      } catch (err) {
        setTrackError(
          err instanceof Error ? err.message : 'Failed to remove track'
        )
      } finally {
        setRemovingId(null)
      }
    },
    [state, playlistId, actions]
  )

  const startEditingTracks = useCallback(() => {
    setTrackError(null)
    setEditingMeta(false)
    setDeleteConfirm(false)
    setShowAddForm(false)
    setEditingTracks(true)
  }, [])

  // ── Loading (first load only) ────────────────────────────────────────────
  if (state.status === 'loading' && !hasLoadedOnce.current) {
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
  const playlist = state.status === 'ok' ? state.playlist : null

  return (
    <View style={styles.screen}>
      <BackButton onPress={onBack} />

      {/* ── Inline error banner ────────────────────────────────────────── */}
      {(refreshError || trackError || metaError || deleteError) && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            {refreshError || trackError || metaError || deleteError}
          </Text>
        </View>
      )}

      {/* ── Metadata edit form ─────────────────────────────────────────── */}
      {playlist && editingMeta && (
        <View style={styles.editForm}>
          <Text style={styles.editFormLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Playlist title"
            placeholderTextColor="#9ca3af"
            maxLength={200}
          />

          <Pressable
            onPress={() => setEditIsPublic((v) => !v)}
            style={styles.checkboxRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: editIsPublic }}
            accessibilityLabel="Make this playlist public"
          >
            <View
              style={[
                styles.checkbox,
                editIsPublic && styles.checkboxChecked,
              ]}
            >
              {editIsPublic && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Make this playlist public</Text>
          </Pressable>

          {metaError && (
            <Text style={styles.formError}>{metaError}</Text>
          )}

          <View style={styles.editFormButtons}>
            <Pressable
              onPress={handleSaveMeta}
              disabled={savingMeta || !editTitle.trim()}
              style={({ pressed }) => [
                styles.saveButton,
                (savingMeta || !editTitle.trim()) &&
                  styles.saveButtonDisabled,
                pressed &&
                  !savingMeta &&
                  editTitle.trim() &&
                  styles.saveButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save changes"
            >
              <Text style={styles.saveButtonText}>
                {savingMeta ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setEditingMeta(false)
                setMetaError(null)
              }}
              disabled={savingMeta}
              style={({ pressed }) => [
                styles.cancelButton,
                savingMeta && styles.cancelButtonDisabled,
                pressed && !savingMeta && styles.cancelButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel editing"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      {playlist && !editingMeta && (
        <View style={styles.detailHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.heading} numberOfLines={1}>
              {playlist.title}
            </Text>
            <View
              style={[
                styles.badge,
                playlist.isPublic
                  ? styles.badgePublic
                  : styles.badgePrivate,
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
          <View style={styles.subtitleRow}>
            <Text style={styles.subtitle}>
              {playlist.tracks.length}{' '}
              {playlist.tracks.length === 1 ? 'track' : 'tracks'} · Created{' '}
              {new Date(playlist.createdAt).toLocaleDateString()}
            </Text>
            {token && !editingTracks && (
              <View style={styles.actionButtons}>
                <Pressable
                  onPress={startEditingMeta}
                  style={({ pressed }) => [
                    styles.editMetaButton,
                    pressed && styles.editMetaButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Edit playlist"
                >
                  <Text style={styles.editMetaButtonText}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={startEditingTracks}
                  style={({ pressed }) => [
                    styles.editTracksButton,
                    pressed && styles.editTracksButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Edit tracks"
                >
                  <Text style={styles.editTracksButtonText}>Edit Tracks</Text>
                </Pressable>
                {deleteConfirm ? (
                  <>
                    <Pressable
                      onPress={handleDelete}
                      disabled={deleting}
                      style={({ pressed }) => [
                        styles.deleteConfirmButton,
                        deleting && styles.deleteButtonDisabled,
                        pressed && !deleting && styles.deleteConfirmButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Confirm delete playlist"
                    >
                      {deleting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.deleteConfirmButtonText}>
                          Confirm
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setDeleteConfirm(false)
                        setDeleteError(null)
                      }}
                      disabled={deleting}
                      style={({ pressed }) => [
                        styles.deleteCancelButton,
                        deleting && styles.deleteButtonDisabled,
                        pressed && !deleting && styles.deleteCancelButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel delete"
                    >
                      <Text style={styles.deleteCancelButtonText}>Cancel</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={() => setDeleteConfirm(true)}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.deleteButtonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Delete playlist"
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* ── Track editing toolbar ─────────────────────────────────── */}
          {editingTracks && (
            <View style={styles.trackToolbar}>
              <Pressable
                onPress={() => {
                  setShowAddForm((v) => !v)
                  setTrackError(null)
                }}
                style={({ pressed }) => [
                  styles.addTrackButton,
                  pressed && styles.addTrackButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  showAddForm ? 'Cancel adding track' : 'Add track'
                }
              >
                <Text style={styles.addTrackButtonText}>
                  {showAddForm ? 'Cancel' : '+ Add Track'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setEditingTracks(false)
                  setShowAddForm(false)
                  setDeleteConfirm(false)
                  setTrackError(null)
                }}
                style={({ pressed }) => [
                  styles.doneButton,
                  pressed && styles.doneButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Done editing tracks"
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* ── Add track form ────────────────────────────────────────────── */}
      {showAddForm && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Track title"
            placeholderTextColor="#9ca3af"
            maxLength={300}
          />
          <TextInput
            style={styles.input}
            value={newArtist}
            onChangeText={setNewArtist}
            placeholder="Artist name"
            placeholderTextColor="#9ca3af"
            maxLength={300}
          />
          <TextInput
            style={[styles.input, styles.durationInput]}
            value={newDuration}
            onChangeText={setNewDuration}
            placeholder="Duration (seconds)"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            maxLength={6}
          />
          {trackError && (
            <Text style={styles.formError}>{trackError}</Text>
          )}

          <Pressable
            onPress={handleAddTrack}
            disabled={
              savingTracks ||
              removingId !== null ||
              !newTitle.trim() ||
              !newArtist.trim() ||
              !newDuration.trim()
            }
            style={({ pressed }) => [
                styles.submitButton,
                (savingTracks ||
                  !newTitle.trim() ||
                  !newArtist.trim() ||
                  !newDuration.trim()) &&
                  styles.submitButtonDisabled,
                pressed &&
                  !savingTracks &&
                  newTitle.trim() &&
                  newArtist.trim() &&
                  newDuration.trim() &&
                  styles.submitButtonPressed,
              ]}
            accessibilityRole="button"
            accessibilityLabel="Save track"
          >
          <Text style={styles.submitButtonText}>
            {savingTracks ? 'Adding…' : 'Add Track'}
          </Text>
          </Pressable>
        </View>
      )}

      {/* ── Track list ────────────────────────────────────────────────── */}
      {playlist && playlist.tracks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>This playlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add tracks to get started
          </Text>
        </View>
      ) : playlist ? (
        <FlatList
          data={playlist.tracks}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <TrackRow
              track={item}
              position={index + 1}
              onRemove={handleRemoveTrack}
              editing={editingTracks}
              removing={removingId === item.id}
              anyRemoving={removingId !== null || savingTracks}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.trackList}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      ) : null}
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

  // Error banner
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: '#b00020',
    fontSize: 13,
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
  subtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
  },

  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },

  // Edit metadata
  editMetaButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  editMetaButtonPressed: {
    borderColor: '#2563eb',
  },
  editMetaButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },

  // Edit form
  editForm: {
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  editFormLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
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
    fontSize: 13,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#374151',
  },
  editFormButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1a7f37',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#d1d5db',
    opacity: 0.6,
  },
  saveButtonPressed: {
    backgroundColor: '#157a31',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonPressed: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },

  // Delete button
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteButtonPressed: {
    backgroundColor: '#fef2f2',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#b00020',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteConfirmButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#b00020',
    minWidth: 48,
    alignItems: 'center',
  },
  deleteConfirmButtonPressed: {
    backgroundColor: '#8b0015',
  },
  deleteConfirmButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  deleteCancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  deleteCancelButtonPressed: {
    backgroundColor: '#f3f4f6',
  },
  deleteCancelButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },

  // Edit tracks
  editTracksButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  editTracksButtonPressed: {
    borderColor: '#2563eb',
  },
  editTracksButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },

  // Track toolbar
  trackToolbar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  addTrackButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#1a7f37',
  },
  addTrackButtonPressed: {
    backgroundColor: '#157a31',
  },
  addTrackButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  doneButtonPressed: {
    backgroundColor: '#f3f4f6',
  },
  doneButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },

  // Add form
  addForm: {
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  durationInput: {
    width: 160,
  },
  submitButton: {
    backgroundColor: '#1a7f37',
    borderRadius: 8,
    paddingVertical: 10,
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
  formError: {
    color: '#b00020',
    fontSize: 13,
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
    marginRight: 8,
  },

  // Remove button
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
  },
  removeButtonPressed: {
    backgroundColor: '#fecaca',
  },
  removeButtonDisabled: {
    opacity: 0.5,
  },
  removeButtonText: {
    fontSize: 14,
    color: '#b00020',
    fontWeight: '600',
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
