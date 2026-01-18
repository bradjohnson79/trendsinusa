import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma client.
 * In dev, keep one instance across hot reloads.
 *
 * In serverless (Vercel), a singleton per lambda instance is expected and safe:
 * - Avoids creating a new client for every request
 * - Avoids long-lived servers/listeners (Prisma uses pooled connections per process)
 */
export const prisma: PrismaClient = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

