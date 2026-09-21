import { PrismaClient } from "@prisma/client";

// Global singleton instance for Prisma Client in development/production
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

// Ensure SQLite uses Write-Ahead Logging (WAL) for non-blocking concurrent reads and writes
prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;").catch((err) => {
  console.warn("Failed to set SQLite WAL mode:", err);
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
