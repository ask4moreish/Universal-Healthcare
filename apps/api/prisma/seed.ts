/**
 * Idempotent seed script for local development and the k6 load test.
 *
 * Creates three users with the same known password so you can log in
 * as any of them with `Password123!`:
 *
 *   - creator@universal-healthcare.local  (creator, verified)
 *   - fan@universal-healthcare.local      (fan, verified)
 *   - unverified@universal-healthcare.local (no role, unverified email)
 *
 * The script is idempotent: re-running it on a database that already has
 * these users is a no-op. Use `pnpm --filter @universal-healthcare/api
 * exec prisma db seed` (or `npx prisma db seed`) to run.
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const DEMO_PASSWORD = "Password123!"

async function userExists(email: string): Promise<boolean> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  return existing !== null
}

async function seedCreator(passwordHash: string): Promise<void> {
  const email = "creator@universal-healthcare.local"
  if (await userExists(email)) return

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      emailVerified: true,
      creatorProfile: {
        create: {
          displayName: "Dr. Demo Creator",
          slug: "demo-creator",
          bio: "A seeded demo creator account for local development and load tests.",
          genre: "primary-care",
          location: "Demo City",
          isVerified: true,
        },
      },
    },
  })
  console.log(`  + creator  ${email}`)
}

async function seedFan(passwordHash: string): Promise<void> {
  const email = "fan@universal-healthcare.local"
  if (await userExists(email)) return

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      emailVerified: true,
      fanProfile: {
        create: {
          displayName: "Demo Fan",
          genrePrefs: JSON.stringify(["primary-care", "cardiology"]),
        },
      },
    },
  })
  console.log(`  + fan      ${email}`)
}

async function seedUnverified(passwordHash: string): Promise<void> {
  const email = "unverified@universal-healthcare.local"
  if (await userExists(email)) return

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      emailVerified: false,
    },
  })
  console.log(`  + unverified ${email}`)
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)

  await seedCreator(passwordHash)
  await seedFan(passwordHash)
  await seedUnverified(passwordHash)

  console.log("")
  console.log(`Seed complete. Demo password: ${DEMO_PASSWORD}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
