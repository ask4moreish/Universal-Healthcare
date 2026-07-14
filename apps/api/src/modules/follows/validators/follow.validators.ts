// Re-export Zod schemas from @universal-healthcare/shared so the controller
// doesn't reach into shared directly. Mirrors the pattern in
// apps/api/src/modules/comments/validators/comment.validators.ts.
export {
  followeeIdParamSchema,
  userIdParamSchema,
} from '@universal-healthcare/shared'
