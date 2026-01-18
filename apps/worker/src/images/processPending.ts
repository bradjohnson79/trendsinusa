import { prisma } from '@trendsinusa/db';

import { DalleImageProvider } from './providers/dalle.js';
import { ProceduralImageProvider } from './providers/procedural.js';
import { writeVariantsWebp } from './processor.js';
import { IMAGE_VARIANTS, type ImageIntentEntityType, type ImageIntentImageType } from './types.js';
import { maybeAdvanceToReadyAndPublish, transitionPostingItem } from '../posting/lifecycle.js';

function safeSeg(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function promptForRetailProduct(params: { title: string; category: string | null | undefined }) {
  const cat = params.category ? `Category: ${params.category}` : 'Category: unknown';
  // Keep prompt tight + consistent. Explicitly deny branding/logos/trademarks.
  return `Create a clean, high-quality product image suitable for an ecommerce card.
${cat}
Subject: a generic, unbranded representation of the product described by: "${params.title}".
Style: photorealistic studio lighting, neutral background, centered, no clutter.
Constraints: do not include any logos, trademarks, brand names, packaging text, labels, or any text.`;
}

function promptForDiscoveryCandidate(params: { title: string; category: string | null | undefined }) {
  const cat = params.category ? `Category: ${params.category}` : 'Category: unknown';
  return `Create a clean, high-quality product-style image suitable for an informational post card.
${cat}
Subject: a generic, unbranded representation inspired by: "${params.title}".
Style: simple, minimal, neutral background, centered.
Constraints: no logos, no trademarks, no brand names, no packaging text, no labels, no text, no letters, no numbers.`;
}

function openAiNativeSizeFor(imageType: ImageIntentImageType): '1024x1024' | '1792x1024' {
  // Use a native size that minimizes upscaling.
  if (imageType === 'CARD') return '1024x1024';
  // OG/HERO are landscape: generate 1792x1024 then crop/cover to target.
  return '1792x1024';
}

async function logFailure(intentId: string, message: string) {
  // Best-effort: mark intent failed + create a visible system alert.
  await prisma.imageIntent.update({ where: { id: intentId }, data: { status: 'FAILED' } }).catch(() => null);
  await prisma.systemAlert
    .create({
      data: {
        type: 'SYSTEM',
        severity: 'ERROR',
        message: `[image-intent] ${intentId}: ${message}`,
        noisy: false,
      },
    })
    .catch(() => null);
}

export async function processPendingImageIntents(params: { limit?: number } = {}) {
  const limit = params.limit ?? 10;
  const providerKey = String(process.env.IMAGE_PROVIDER ?? 'procedural').toLowerCase();
  const provider =
    providerKey === 'dalle' || providerKey === 'openai' ? new DalleImageProvider() : new ProceduralImageProvider();

  const intents = await prisma.imageIntent.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true, entityType: true, entityId: true, imageType: true, createdAt: true },
  });

  const results: Array<{ id: string; ok: boolean; reason?: string; outputs?: string[] }> = [];

  for (const intent of intents) {
    try {
      // Resolve prompt from entity.
      let prompt = '';
      if ((intent.entityType as ImageIntentEntityType) === 'RETAIL_PRODUCT') {
        const product = await prisma.product
          .findUnique({ where: { id: intent.entityId }, select: { title: true, category: true } })
          .catch(() => null);
        if (!product) throw new Error(`RETAIL_PRODUCT not found for entityId=${intent.entityId}`);
        prompt = promptForRetailProduct({ title: product.title, category: product.category });
      } else if ((intent.entityType as ImageIntentEntityType) === 'DISCOVERY_CANDIDATE') {
        const c = await prisma.discoveryCandidate
          .findUnique({ where: { id: intent.entityId }, select: { title: true, category: true } })
          .catch(() => null);
        if (!c) throw new Error(`DISCOVERY_CANDIDATE not found for entityId=${intent.entityId}`);
        prompt = promptForDiscoveryCandidate({ title: c.title, category: c.category });
      } else {
        throw new Error(`Unsupported entityType=${intent.entityType} (no backing model yet)`);
      }

      const imageType = intent.imageType as ImageIntentImageType;
      const variants = IMAGE_VARIANTS[imageType] ?? [];
      if (!variants.length) throw new Error(`No variants configured for imageType=${imageType}`);

      const master = await provider.generate({ prompt, size: openAiNativeSizeFor(imageType) });

      const outDirParts = ['intents', String(intent.entityType), safeSeg(String(intent.entityId)) || 'entity', String(intent.imageType), intent.id];
      const rendered = await writeVariantsWebp({ master, outDirParts, variants });

      await prisma.imageIntent.update({ where: { id: intent.id }, data: { status: 'GENERATED' } });
      results.push({ id: intent.id, ok: true, outputs: rendered.variants.map((v) => v.relativePath) });

      // Posting lifecycle: IMAGED when we generated an image for a retail product.
      if ((intent.entityType as ImageIntentEntityType) === 'RETAIL_PRODUCT') {
        const posting = await prisma.postingItem.findUnique({ where: { productId: intent.entityId }, select: { id: true, state: true } }).catch(() => null);
        if (posting && posting.state === 'ENRICHED') {
          await transitionPostingItem({ id: posting.id, to: 'IMAGED' }).catch(() => null);
          await maybeAdvanceToReadyAndPublish({ postingItemId: posting.id }).catch(() => null);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      await logFailure(intent.id, message);
      results.push({ id: intent.id, ok: false, reason: message });
    }
  }

  return { ok: true as const, processed: intents.length, results };
}

// CLI entrypoint (manual, no scheduling)
if (import.meta.url === `file://${process.argv[1]}`) {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? Math.max(1, Math.min(50, Math.trunc(Number(limitArg)))) : 10;
  const out = await processPendingImageIntents({ limit });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

