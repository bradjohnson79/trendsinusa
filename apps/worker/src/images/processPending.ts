import { prisma } from '@trendsinusa/db';

/**
 * Permanent policy: procedural-only image generation.
 *
 * This intent processor is currently a no-op for storage: we do not persist
 * generated assets yet. To avoid endless retries, we mark intents as GENERATED
 * and emit a system alert.
 */
export async function processPendingImageIntents(params: { limit?: number } = {}) {
  const limit = params.limit ?? 5;

  const intents = await prisma.imageIntent
    .findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, entityType: true, entityId: true, imageType: true },
    })
    .catch(() => []);

  if (intents.length === 0) return { ok: true as const, processed: 0 };

  for (const intent of intents) {
    await prisma.imageIntent.update({ where: { id: intent.id }, data: { status: 'GENERATED' } }).catch(() => null);
    await prisma.systemAlert
      .create({
        data: {
          type: 'SYSTEM',
          severity: 'INFO',
          noisy: false,
          message: `[image-intent] skipped generation (procedural-only policy, no storage) intent=${intent.id} type=${intent.imageType}`,
        },
      })
      .catch(() => null);
  }

  return { ok: true as const, processed: intents.length };
}
