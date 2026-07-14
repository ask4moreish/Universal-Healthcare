import type { PaginationMeta } from './pagination.types.js'

/**
 * Builds the standard paginated response envelope. Returns the 4
 * `PaginationMeta` fields (page, pageSize, total, totalPages) PLUS
 * convenience booleans `hasNext` and `hasPrev` so clients don't have to
 * recompute them.
 *
 * Used by the comment, follow, and notification controllers —
 * refactored from a triplicated inline pattern (the original local
 * `envelope()` helpers in those controllers, and the inline
 * `totalPages` + `hasNext` + `hasPrev` block in `comment.controller.ts`).
 *
 * Note: the older `paginate.ts` `metaFromTotal()` (also in this folder)
 * is NOT replaced by this helper — it returns the bare 4-field
 * `PaginationMeta` and is used by `paginateCreators()` for the
 * creators list endpoint, which doesn't need the convenience booleans.
 * Keeping the two helpers separate avoids an unrelated behavior change
 * to the creators list response shape.
 */
export function envelope(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta & { hasNext: boolean; hasPrev: boolean } {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}
