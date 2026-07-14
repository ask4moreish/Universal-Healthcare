import { Router } from 'express'
import { requireAuth } from '../../../shared/middleware/auth.middleware.js'
import { commentController } from '../controllers/comment.controller.js'

// Mounted at `/api/comments` in app.ts. Routes here are RELATIVE to that
// mount point — so `/:id` resolves to `/api/comments/:id` from the outside.
export const commentRouter: Router = Router()

// Public list endpoint — must precede the requireAuth gate so anonymous
// callers can fetch comments on public playlists.
commentRouter.get('/playlists/:playlistId', (req, res, next) => {
  commentController.listForPlaylist(req, res, next).catch(next)
})

// Public single-comment read. The service gates on the parent playlist's
// `isPublic` so private comments are not leaked via direct id lookup.
commentRouter.get('/:id', (req, res, next) => {
  commentController.getById(req, res, next).catch(next)
})

commentRouter.use(requireAuth)

// Create is auth-required (writes). Service rejects attempts to comment on
// private playlists.
commentRouter.post('/playlists/:playlistId', (req, res, next) => {
  commentController.create(req, res, next).catch(next)
})

// Edit / delete are auth-required AND ownership-checked in the service.
commentRouter.patch('/:id', (req, res, next) => {
  commentController.update(req, res, next).catch(next)
})

commentRouter.delete('/:id', (req, res, next) => {
  commentController.delete(req, res, next).catch(next)
})
