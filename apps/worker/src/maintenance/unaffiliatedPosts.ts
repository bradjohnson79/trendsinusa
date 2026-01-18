import { prisma } from '@trendsinusa/db';

/**
 * Expire unaffiliated posts when their freshness window ends or their link becomes inactive.
 *
 * - Expired posts are retained briefly for audit.
 * - Hard delete after 7 days to prevent zombie content buildup.
 */
export async function expireUnaffiliatedPosts(now = new Date()) {
  const expiredByTime = await prisma.unaffiliatedPost
    .updateMany({
      where: { status: 'PUBLISHED', expiresAt: { not: null, lte: now } },
      data: { status: 'EXPIRED' },
    })
    .catch(() => ({ count: 0 }));

  const expiredByLink = await prisma.unaffiliatedPost
    .updateMany({
      where: { status: 'PUBLISHED', linkStatus: 'DEAD' as any },
      data: { status: 'EXPIRED', expiresAt: now },
    })
    .catch(() => ({ count: 0 }));

  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const deleted = await prisma.unaffiliatedPost
    .deleteMany({
      where: { status: 'EXPIRED', expiresAt: { not: null, lt: cutoff } },
    })
    .catch(() => ({ count: 0 }));

  return { expired: expiredByTime.count + expiredByLink.count, expiredByTime: expiredByTime.count, expiredByLink: expiredByLink.count, deleted: deleted.count };
}

