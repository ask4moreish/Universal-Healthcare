import { AppError } from '../../../shared/errors/app-error.js'
import { notificationService } from '../../notifications/services/notification.service.js'
import { playlistRepository } from '../../playlists/repositories/playlist.repository.js'
import { commentRepository } from '../repositories/comment.repository.js'
import type {
  Comment,
  CreateCommentPayload,
  UpdateCommentPayload,
} from '../types/comment.types.js'

export interface CommentListResult {
  items: Comment[]
  total: number
  page: number
  pageSize: number
}

export const commentService = {
  async listForPlaylist(
    playlistId: string,
    page: number,
    pageSize: number
  ): Promise<CommentListResult> {
    // 404 (not 403) when the playlist is private or missing — same rationale
    // as `playlistService.getPublicById`: don't leak which playlist IDs exist.
    const playlist = await playlistRepository.findById(playlistId)
    if (!playlist || !playlist.isPublic) {
      throw new AppError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found')
    }
    const { items, total } = await commentRepository.listTopLevelForPlaylist(
      playlistId,
      page,
      pageSize
    )
    return { items, total, page, pageSize }
  },

  async create(
    payload: CreateCommentPayload,
    requestingUserId: string
  ): Promise<Comment> {
    const playlist = await playlistRepository.findById(payload.playlistId)
    // 404 (not 403) — do not leak which playlist IDs exist OR which are
    // private. Same rationale as `playlistService.getPublicById`.
    if (!playlist || !playlist.isPublic) {
      throw new AppError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found')
    }
    // Resolve the parent once if there is one — the body uses `parent` again
    // for the notification side-effect below, so we hold a reference to it.
    let parent: Comment | null = null
    if (payload.parentId) {
      parent = await commentRepository.findById(payload.parentId)
      if (!parent || parent.playlistId !== payload.playlistId) {
        throw new AppError(
          400,
          'INVALID_PARENT',
          'Parent comment not found in this playlist'
        )
      }
    }

    const comment = await commentRepository.create({
      userId: requestingUserId,
      playlistId: payload.playlistId,
      parentId: payload.parentId,
      body: payload.body,
    })

    // ─── Side-effect: emit a 'comment_reply' notification ──────────────
    // Only on REPLIES (not top-level comments), and only when the reply is
    // from a different user (no self-reply ping). Same pattern as Follows:
    // sequential emit, NOT cross-service $transaction, NOT blocking on failure.
    if (parent && parent.userId !== requestingUserId) {
      try {
        await notificationService.emit({
          recipientId: parent.userId,
          actorId: requestingUserId,
          type: 'comment_reply',
          entityType: 'comment',
          entityId: comment.id,
        })
      } catch (err) {
        void err
      }
    }

    return comment
  },

  async getById(id: string): Promise<Comment> {
    const comment = await commentRepository.findById(id)
    if (!comment) {
      throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found')
    }
    // Privacy gate: direct id lookup of a comment must NOT leak the body
    // of a comment whose parent playlist has been flipped to private since
    // the comment was written. Same 404-not-403-on-private rationale.
    const parent = await playlistRepository.findById(comment.playlistId)
    if (!parent || !parent.isPublic) {
      throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found')
    }
    return comment
  },

  async update(
    id: string,
    input: UpdateCommentPayload,
    requestingUserId: string
  ): Promise<Comment> {
    const comment = await commentRepository.findById(id)
    if (!comment) {
      throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found')
    }
    if (comment.userId !== requestingUserId) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'You do not have permission to edit this comment'
      )
    }
    return commentRepository.update(id, input)
  },

  async delete(id: string, requestingUserId: string): Promise<void> {
    const comment = await commentRepository.findById(id)
    if (!comment) {
      throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found')
    }
    if (comment.userId !== requestingUserId) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'You do not have permission to delete this comment'
      )
    }
    await commentRepository.delete(id)
  },
}
