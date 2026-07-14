import { Router } from 'express'
import { searchController } from '../controllers/search.controller.js'

// Mounted at `/api/search` in app.ts. The search endpoint is PUBLIC —
// no `requireAuth` gate. Anonymous callers can search creators + public
// playlists + comments on public playlists. The repository layer enforces
// the `isPublic: true` privacy gate on playlists / comments; creators are
// always public.
export const searchRouter: Router = Router()

searchRouter.get('/', (req, res, next) => {
  searchController.search(req, res, next).catch(next)
})
