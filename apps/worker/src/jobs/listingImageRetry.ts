import { prisma } from '@trendsinusa/db';

import { generateThumbnailDataUrl, verifyOutboundLink } from '../enrichment/postEnrichment.js';

/**
 * Retry image generation for TEMP_APPROVED listings.
 * - Never denies on image failure.
 * - Denies only if link becomes invalid.
 */
export async function runListingImageRetry(params: { limit?: number } = {}) {
  const limit = params.limit ?? 40;
  const now = new Date();

  const rows = await prisma.discoveryCandidate
    .findMany({
      where: {
        status: 'ACTIVE',
        isFresh: true,
        approvalStatus: 'TEMP_APPROVED' as any,
      },
      orderBy: [{ confidenceScore: 'desc' }, { discoveredAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        retailer: true,
        category: true,
        description: true,
        shortDescription: true,
        outboundUrl: true,
        confidenceScore: true,
        thumbnailUrl: true,
        thumbnailInputHash: true,
        linkStatus: true,
        lastCheckedAt: true,
      },
    })
    .catch(() => []);

  let promoted = 0;
  let stayedTemp = 0;
  let denied = 0;

  for (const r of rows) {
    try {
      const link = await verifyOutboundLink(r.outboundUrl);
      if (!link.isActive) {
        await prisma.discoveryCandidate
          .update({
            where: { id: r.id },
            data: {
              approvalStatus: 'DENIED' as any,
              status: 'REMOVED' as any,
              linkStatus: link.status as any,
              lastCheckedAt: now,
              expiresAt: now,
            },
          })
          .catch(() => null);
        denied += 1;
        continue;
      }

      const t = await generateThumbnailDataUrl({
        title: r.title,
        category: r.category ?? 'General',
        shortDescription: r.shortDescription ?? r.description ?? null,
        confidenceScore: r.confidenceScore ?? null,
        outboundUrl: r.outboundUrl,
      });

      const isApproved = Boolean(t.url);
      await prisma.discoveryCandidate
        .update({
          where: { id: r.id },
          data: {
            linkStatus: 'ACTIVE' as any,
            lastCheckedAt: now,
            thumbnailUrl: t.url,
            thumbnailGeneratedAt: now,
            thumbnailSource: t.source,
            thumbnailInputHash: t.inputHash,
            approvalStatus: (isApproved ? 'APPROVED' : 'TEMP_APPROVED') as any,
          },
        })
        .catch(() => null);

      if (isApproved) promoted += 1;
      else stayedTemp += 1;
    } catch {
      stayedTemp += 1;
    }
  }

  return { ok: true as const, promoted, stayedTemp, denied, scanned: rows.length };
}

