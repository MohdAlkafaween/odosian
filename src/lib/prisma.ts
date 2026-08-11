import { PrismaClient } from "../../prisma/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || "file:./dev.db",
  });

  const client = new PrismaClient({
    adapter,
    omit: { user: { password: true } },
  }) as PrismaClient;

  // better-sqlite3's default journal mode (DELETE) takes an exclusive lock
  // for the duration of every write and rejects any other write attempted
  // in that window with SQLITE_BUSY immediately — no retry, no queueing.
  // With a background batch loop writing item statuses every few seconds
  // AND a user able to hit pause/stop/resume at any moment, that collision
  // is a real, reachable race, not a hypothetical one — it surfaced as
  // "Failed to pause batch" (a plain 500 with no matching {error} body,
  // since nothing was catching it). WAL mode lets readers and a writer
  // proceed concurrently instead of exclusive-locking the whole file, and
  // busy_timeout makes SQLite retry for up to 5s on the (now much rarer)
  // remaining writer-vs-writer collision instead of failing instantly.
  client.$executeRawUnsafe("PRAGMA journal_mode = WAL;").catch(() => {});
  client.$executeRawUnsafe("PRAGMA busy_timeout = 5000;").catch(() => {});

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
