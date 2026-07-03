import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Enable WAL mode for better concurrent read performance
// WAL allows readers to not block writers and vice versa
if (typeof db.$queryRawUnsafe === 'function') {
  void db.$executeRawUnsafe('PRAGMA journal_mode=WAL').catch(() => {
    // WAL may not be supported in all environments; silently degrade
  });
  void db.$executeRawUnsafe('PRAGMA busy_timeout=5000').catch(() => {});
}