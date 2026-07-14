import { prisma } from '../../../shared/database/prisma.js'
import type { Notification } from '../types/notification.types.js'

type RawNotification = {
  id: string
  recipientId: string
  actorId: string | null
  type: string
  entityType: string
  entityId: string
  read: boolean
  createdAt: Date
  updatedAt: Date
}

// At the api/repository boundary we cast `type` and `entityType` from
// `string` to the narrowed union. Prisma stores them as `String` per
// docs/decisions/0002 (no native Postgres ENUM). In v1 we trust writers
// (only `notificationService.emit` ever writes these columns) and the
// Zod `notificationTypeSchema` when reading from external input.
function notificationFromPrisma(raw: RawNotification): Notification {
  return {
    ...raw,
    type: raw.type as 'follow' | 'comment_reply',
    entityType: raw.entityType as 'follow' | 'comment',
  }
}

export const notificationRepository = {
  async listForRecipient(
    recipientId: string,
    page: number,
    pageSize: number
  ): Promise<{ items: Notification[]; total: number }> {
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where: { recipientId } }),
    ])
    return { items: rows.map(notificationFromPrisma), total }
  },

  async findById(id: string): Promise<Notification | null> {
    const row = await prisma.notification.findUnique({ where: { id } })
    return row ? notificationFromPrisma(row) : null
  },

  async emit(input: {
    recipientId: string
    actorId: string | null
    type: 'follow' | 'comment_reply'
    entityType: 'follow' | 'comment'
    entityId: string
  }): Promise<Notification> {
    const row = await prisma.notification.create({ data: input })
    return notificationFromPrisma(row)
  },

  async markRead(id: string): Promise<Notification> {
    const row = await prisma.notification.update({
      where: { id },
      data: { read: true },
    })
    return notificationFromPrisma(row)
  },

  // Bulk-marks all of a recipient's unread notifications. `updateMany`
  // returns `{ count }` — atomic at the SQL level (single UPDATE statement).
  async markAllRead(recipientId: string): Promise<{ count: number }> {
    const result = await prisma.notification.updateMany({
      where: { recipientId, read: false },
      data: { read: true },
    })
    return { count: result.count }
  },

  async delete(id: string): Promise<void> {
    await prisma.notification.delete({ where: { id } })
  },
}
