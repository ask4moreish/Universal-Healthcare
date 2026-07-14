import type { NextFunction, Request, Response } from 'express'
import { paginationSchema } from '@universal-healthcare/shared'
import { AppError } from '../../../shared/errors/app-error.js'
import { envelope } from '../../../shared/pagination/format.js'
import { notificationService } from '../services/notification.service.js'
import { toNotificationResponse } from '../types/notification.types.js'
import { notificationIdParamSchema } from '../validators/notification.validators.js'

function userIdOrThrow(req: Request): string {
  const id = (req as Request & { userId?: string }).userId
  if (!id) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required')
  }
  return id
}

export const notificationController = {
  async listMine(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const me = userIdOrThrow(req)
      const { page, pageSize } = paginationSchema.parse(req.query)
      const { items, total } = await notificationService.listMine(
        me,
        page,
        pageSize
      )
      res.status(200).json({
        data: items.map(toNotificationResponse),
        pagination: envelope(page, pageSize, total),
      })
    } catch (err) {
      next(err)
    }
  },

  async markRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const me = userIdOrThrow(req)
      const { id } = notificationIdParamSchema.parse(req.params)
      const notification = await notificationService.markRead(id, me)
      res.status(200).json({ data: toNotificationResponse(notification) })
    } catch (err) {
      next(err)
    }
  },

  async markAllRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const me = userIdOrThrow(req)
      const { count } = await notificationService.markAllRead(me)
      res.status(200).json({ data: { count } })
    } catch (err) {
      next(err)
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const me = userIdOrThrow(req)
      const { id } = notificationIdParamSchema.parse(req.params)
      await notificationService.delete(id, me)
      // 204 No Content — matches playlist.controller.ts:106-110 / follow.controller.ts.
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
}
