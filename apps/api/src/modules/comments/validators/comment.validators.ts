// The api module re-exports Zod schemas from `@universal-healthcare/shared`
// instead of importing from `shared/validation/*` directly. This indirection
// creates a single seam: if a module-local override is ever needed
// (e.g. logging slow validation rates), it goes here.
export {
  createCommentSchema,
  updateCommentSchema,
  commentIdParamSchema,
} from '@universal-healthcare/shared'
