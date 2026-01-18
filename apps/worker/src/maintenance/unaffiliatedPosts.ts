import { prisma } from '@trendsinusa/db';

/**
 * Expire published unaffiliated posts once their expiresAt has passed.
 * Retains rows for audit/logs; only flips status.
 */
export async function expireUnaffiliatedPosts(now = new Date()) {
  const r = await prisma.unaffiliatedPost
    .updateMany({
      where: { status: 'PUBLISHED', expiresAt: { not: null, lte: now } },
      data: { status: 'EXPIRED' },
    })
    .catch(() => ({ count: 0 }));
  return { expired: r.count };
}

