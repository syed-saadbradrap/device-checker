import path from "node:path";
import { PrismaClient } from "@prisma/client";

/** Ensure Prisma always has a SQLite URL, even if .env wasn't loaded yet. */
function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return;
  const dbPath = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${dbPath}`;
}

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
