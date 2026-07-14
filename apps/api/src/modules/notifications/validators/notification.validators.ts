// Re-export Zod schemas from @universal-healthcare/shared so the controller
// doesn't reach into shared directly.
export { notificationIdParamSchema } from '@universal-healthcare/shared'

// NOTE: `notificationTypeSchema` (z.enum(['follow', 'comment_reply'])) is
// defined in shared/validation/notification.ts but is NOT re-exported here.
// The api never accepts `type` from HTTP client input \u2014 it's written only by
// the inter-service `notificationService.emit(...)` entry point, where
// TypeScript's type system provides the narrowing. Cross-service consumers
// will import the Zod schema directly from `@universal-healthcare/shared`
// when they need runtime validation.
