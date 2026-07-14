import type { PaginationMeta } from './pagination.js'

// ─────────────────────────────────────────────────────────────────────────────
//  Response shape returned by the api.
//
//  Both `type` and `entityType` are typed as string-literal unions here so
//  web/mobile clients get autocomplete. The api stores them as plain
//  `String` columns in Prisma (per docs/decisions/0002-sqlite-dev-postgres-prod.md
//  native Postgres ENUMs are banned), validated by
//  `notificationTypeSchema` in shared/validation/notification.ts.
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationResponse {
  id: string
  recipientId: string
  actorId: string | null
  type: 'follow' | 'comment_reply'
  entityType: 'follow' | 'comment'
  entityId: string
  read: boolean
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
//  Paginated envelope used by GET /api/notifications.
// ─────────────────────────────────────────────────────────────────────────────

export interface ListNotificationsResponse {
  data: NotificationResponse[]
  pagination: PaginationMeta
}
