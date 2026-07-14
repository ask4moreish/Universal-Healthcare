import type { NotificationResponse } from '@universal-healthcare/shared'

// ─────────────────────────────────────────────────────────────────────────────
//  Internal types — DB-layer representation.
//
//  `type` and `entityType` are narrowed via casts in the repository
//  (`notificationFromPrisma` below) — the Prisma column is `String` for
//  cross-DB portability.
// ─────────────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  recipientId: string
  actorId: string | null
  type: 'follow' | 'comment_reply'
  entityType: 'follow' | 'comment'
  entityId: string
  read: boolean
  createdAt: Date
  updatedAt: Date
}

// ─────────────────────────────────────────────────────────────────────────────
//  DTO conversion — internal (Date) → public DTO (ISO string).
// ─────────────────────────────────────────────────────────────────────────────

export function toNotificationResponse(n: Notification): NotificationResponse {
  return {
    id: n.id,
    recipientId: n.recipientId,
    actorId: n.actorId,
    type: n.type,
    entityType: n.entityType,
    entityId: n.entityId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }
}
