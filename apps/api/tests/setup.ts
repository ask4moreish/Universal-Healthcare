import { afterAll, beforeEach } from 'vitest'
import { prisma } from '../src/shared/database/prisma.js'

beforeEach(async () => {
  // Order matters: child tables first, then the User cascade clears the rest.
  // Also: even with onDelete: Cascade, explicit deletes are required for
  // SQLite FK safety (the cascade only fires inside a transaction that holds
  // the FK lock — without it, the next test can hit UNIQUE or FK errors).
  await prisma.comment.deleteMany()
  await prisma.passwordResetToken.deleteMany()
  await prisma.emailVerificationToken.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.track.deleteMany()
  await prisma.playlist.deleteMany()
  await prisma.fanProfile.deleteMany()
  await prisma.creatorProfile.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})
