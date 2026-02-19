import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

function getDbPath(): string {
  const url = process.env.DATABASE_URL || 'file:./dev.db'
  const filePath = url.startsWith('file:') ? url.slice(5) : url
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

if (!globalForPrisma.prisma) {
  const adapter = new PrismaBetterSqlite3({ url: getDbPath() })
  globalForPrisma.prisma = new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma
