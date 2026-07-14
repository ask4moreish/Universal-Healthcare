import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
//  URL param schemas.
//  `type` field validation is intentionally omitted here. Notification `type`
//  is written ONLY by the api's internal `notificationService.emit(...)` entry
//  point, called by `followService.create` and `commentService.create` —
//  TypeScript's narrowing on the parameter type is the runtime guarantee.
//
//  If a future endpoint accepts `type` from client input, define that schema
//  inline in apps/api/src/modules/notifications/validators/ along with the
//  endpoint's other Zod schemas.
// ─────────────────────────────────────────────────────────────────────────────

// `PATCH /api/notifications/:id/read` and `DELETE /api/notifications/:id`
export const notificationIdParamSchema = z.object({
  id: z.string().min(1),
})
