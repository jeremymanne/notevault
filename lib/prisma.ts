import { PrismaClient } from '@/app/generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    datasource: {
      url: process.env.DATABASE_URL,
    },
  })
}

export const prisma = globalForPrisma.prisma
