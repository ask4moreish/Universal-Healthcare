import type { NextFunction, Request, Response } from 'express'
import { paginationSchema } from '@universal-healthcare/shared'
import { AppError } from '../../../shared/errors/app-error.js'
import { envelope } from '../../../shared/pagination/format.js'
import { followService } from '../services/follow.service.js'
import { toFollowResponse } from '../types/follow.types.js'
import {
  followeeIdParamSchema,
  userIdParamSchema,
} from '../validators/follow.validators.js'

function userIdOrThrow(req: Request): string {
  const id = (req as Request & { userId?: string }).userId
  if (!id) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required')
  }
  return id
}

export const followController = {
  async follow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const me = userIdOrThrow(req)
      const { followeeId } = followeeIdParamSchema.parse(req.params)
      const follow = await followService.create(followeeId, me)
      res.status(201).json({ data: toFollowResponse(follow) })
    } catch (err) {
      next(err)
    }
  },

  async unfollow(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const me = userIdOrThrow(req)
      const { followeeId } = followeeIdParamSchema.parse(req.params)
      await followService.delete(followeeId, me)
      // 204 No Content — matches playlist.controller.ts:106-110.
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },

  async listMyFollowing(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const me = userIdOrThrow(req)
      const { page, pageSize } = paginationSchema.parse(req.query)
      const { items, total } = await followService.listMyFollowing(
        me,
        page,
        pageSize
      )
      res.status(200).json({
        data: items.map(toFollowResponse),
        pagination: envelope(page, pageSize, total),
      })
    } catch (err) {
      next(err)
    }
  },

  async listMyFollowers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const me = userIdOrThrow(req)
      const { page, pageSize } = paginationSchema.parse(req.query)
      const { items, total } = await followService.listMyFollowers(
        me,
        page,
        pageSize
      )
      res.status(200).json({
        data: items.map(toFollowResponse),
        pagination: envelope(page, pageSize, total),
      })
    } catch (err) {
      next(err)
    }
  },

  async listUserFollowing(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = userIdParamSchema.parse(req.params)
      const { page, pageSize } = paginationSchema.parse(req.query)
      const { items, total } = await followService.listUserFollowing(
        userId,
        page,
        pageSize
      )
      res.status(200).json({
        data: items.map(toFollowResponse),
        pagination: envelope(page, pageSize, total),
      })
    } catch (err) {
      next(err)
    }
  },

  async listUserFollowers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = userIdParamSchema.parse(req.params)
      const { page, pageSize } = paginationSchema.parse(req.query)
      const { items, total } = await followService.listUserFollowers(
        userId,
        page,
        pageSize
      )
      res.status(200).json({
        data: items.map(toFollowResponse),
        pagination: envelope(page, pageSize, total),
      })
    } catch (err) {
      next(err)
    }
  },
}
