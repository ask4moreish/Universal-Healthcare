import { Prisma } from '@prisma/client'
import { AppError } from '../../../shared/errors/app-error.js'
import {
  followRepository,
  FOLLOW_UNIQUE_VIOLATION,
} from '../repositories/follow.repository.js'
import type { Follow } from '../types/follow.types.js'

export interface FollowListResult {
  items: Follow[]
  total: number
  page: number
  pageSize: number
}

export const followService = {
  async create(followeeId: string, requestingUserId: string): Promise<Follow> {
    // Business rule enforced here (Zod has no access to the JWT-derived
    // currentUserId). Apps/web should still disable the follow button when
    // the target is the current user; this is a defense-in-depth 400.
    if (followeeId === requestingUserId) {
      throw new AppError(
        400,
        'CANNOT_FOLLOW_SELF',
        'You cannot follow yourself'
      )
    }

    const target = await followRepository.findUserById(followeeId)
    if (!target) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
    }

    try {
      return await followRepository.create({
        followerId: requestingUserId,
        followeeId,
      })
    } catch (err) {
      // Concurrent create race: the @@unique([followerId, followeeId])
      // catches it. Without this map, error-handler returns 500.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === FOLLOW_UNIQUE_VIOLATION
      ) {
        throw new AppError(
          409,
          'ALREADY_FOLLOWING',
          'You are already following this user'
        )
      }
      throw err
    }
  },

  async delete(followeeId: string, requestingUserId: string): Promise<void> {
    // Self-unfollow: clients should never allow this button. Defensive 400.
    if (followeeId === requestingUserId) {
      throw new AppError(
        400,
        'CANNOT_UNFOLLOW_SELF',
        'You cannot unfollow yourself'
      )
    }
    const existing = await followRepository.findByPair(
      requestingUserId,
      followeeId
    )
    if (!existing) {
      throw new AppError(
        404,
        'FOLLOW_NOT_FOUND',
        'You are not following this user'
      )
    }
    await followRepository.deleteByPair(requestingUserId, followeeId)
  },

  async listMyFollowing(
    requestingUserId: string,
    page: number,
    pageSize: number
  ): Promise<FollowListResult> {
    const { items, total } = await followRepository.listFollowing(
      requestingUserId,
      page,
      pageSize
    )
    return { items, total, page, pageSize }
  },

  async listMyFollowers(
    requestingUserId: string,
    page: number,
    pageSize: number
  ): Promise<FollowListResult> {
    const { items, total } = await followRepository.listFollowers(
      requestingUserId,
      page,
      pageSize
    )
    return { items, total, page, pageSize }
  },

  async listUserFollowing(
    userId: string,
    page: number,
    pageSize: number
  ): Promise<FollowListResult> {
    // Public reads: a missing userId just yields an empty list. We do NOT
    // 404 here — that would let an attacker enumerate valid user IDs by
    // checking whether they get 200/empty vs 404.
    const { items, total } = await followRepository.listFollowing(
      userId,
      page,
      pageSize
    )
    return { items, total, page, pageSize }
  },

  async listUserFollowers(
    userId: string,
    page: number,
    pageSize: number
  ): Promise<FollowListResult> {
    const { items, total } = await followRepository.listFollowers(
      userId,
      page,
      pageSize
    )
    return { items, total, page, pageSize }
  },
}
