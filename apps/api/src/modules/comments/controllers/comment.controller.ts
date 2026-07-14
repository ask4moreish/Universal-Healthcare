import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { paginationSchema } from '@universal-healthcare/shared'
import { AppError } from '../../../shared/errors/app-error.js'
import { commentService } from '../services/comment.service.js'
import {
  createCommentSchema,
  updateCommentSchema,
  commentIdParamSchema,
} from '../validators/comment.validators.js'
import { toCommentResponse } from '../types/comment.types.js'

function userIdOrThrow(req: Request): string {
  const id = (req as Request & { userId?: string }).userId
  if (!id) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required')
  }
  return id
}

// Schema for the `:playlistId` URL segment used by /playlists/:playlistId
// routes inside this router. We do NOT use .cuid() because the existing
// playlist routes use z.string().min(1) (see apps/api/src/modules/playlists/
// controllers/playlist.controller.ts) — staying consistent.
const playlistIdParamSchema = z.object({ playlistId: z.string().min(1) })

export const commentController = {
  async listForPlaylist(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { playlistId } = playlistIdParamSchema.parse(req.params)
      const { page, pageSize } = paginationSchema.parse(req.query)
      const { items, total } = await commentService.listForPlaylist(
        playlistId,
        page,
        pageSize
      )
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      res.status(200).json({
        data: items.map(toCommentResponse),
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      })
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const me = userIdOrThrow(req)
      const { playlistId } = playlistIdParamSchema.parse(req.params)
      const body = createCommentSchema.parse(req.body)
      const comment = await commentService.create(
        {
          playlistId,
          parentId: body.parentId ?? null,
          body: body.body,
        },
        me
      )
      res.status(201).json({ data: toCommentResponse(comment) })
    } catch (err) {
      next(err)
    }
  },

  async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = commentIdParamSchema.parse(req.params)
      const comment = await commentService.getById(id)
      res.status(200).json({ data: toCommentResponse(comment) })
    } catch (err) {
      next(err)
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const me = userIdOrThrow(req)
      const { id } = commentIdParamSchema.parse(req.params)
      const body = updateCommentSchema.parse(req.body)
      const comment = await commentService.update(id, { body: body.body }, me)
      res.status(200).json({ data: toCommentResponse(comment) })
    } catch (err) {
      next(err)
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const me = userIdOrThrow(req)
      const { id } = commentIdParamSchema.parse(req.params)
      await commentService.delete(id, me)
      // 204 No Content — matches `playlist.controller.ts:106-110`. No body.
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
}
