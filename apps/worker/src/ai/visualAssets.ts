import { prisma } from '@trendsinusa/db';
import { getSiteByKey } from '@trendsinusa/shared/server';
import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import { generatePromoImage } from './openai.js';

const PROMPT_VERSION = 'img-v1-locked';

type DerivedSpec = { name: string; width: number; height: number };

const DERIVED: DerivedSpec[] = [
  { name: 'hero_desktop', width: 1920, height: 1080 },
  { name: 'hero_tablet', width: 1280, height: 720 },
  { name: 'hero_mobile', width: 768, height: 432 },
  { name: 'category_banner', width: 1200, height: 600 },
  { name: 'social_preview', width: 1200, height: 630 },
];

function sha256Hex(input: string) {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function safeSeg(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function assetsRootDirFromWorkerCwd() {
  // scripts run from apps/worker, so ../web/public is stable.
  return path.resolve(process.cwd(), '..', 'web', 'public', 'assets', 'ai');
}

async function exists(p: string) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to download image (${res.status}): ${text.slice(0, 200)}`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

function heroPrompt(params: { siteName: string; tone: 'conservative' | 'neutral' | 'energetic' }) {
  const tone =
    params.tone === 'energetic'
      ? 'bold, energetic, high-contrast, clean'
      : params.tone === 'conservative'
        ? 'calm, premium, minimal, clean'
        : 'modern, clean, balanced';

  // Locked template: only variables are siteName + tone preset.
  return `Create a decorative hero background image for a US deals website (${params.siteName}).
Rules (must follow):
- 16:9 widescreen composition
- Abstract or lifestyle vibe only (decorative background)
- No products
- No logos, no brand marks, no brand names
- No text, no letters, no numbers, no watermarks
- No UI elements, no app screenshots
Style: ${tone}.
Scene: abstract shapes, light gradients, subtle texture, modern ecommerce background, USA-inspired color palette without flags or text.
`;
}

function categoryPrompt(params: { siteName: string; category: string }) {
  // Locked template: only variable is category label.
  return `Create a decorative category banner background image for a US deals website (${params.siteName}).
Rules (must follow):
- 16:9 widescreen composition
- Abstract / lifestyle vibe only (decorative background)
- No products
- No logos, no brand marks, no brand names
- No text, no letters, no numbers, no watermarks
- No UI elements, no app screenshots
Theme: "${params.category}" expressed via abstract shapes, colors, and mood (no literal product depiction).
Style: clean, modern, high-quality, subtle depth, soft gradients.
`;
}

async function renderDerived(
  master: Buffer,
  outDirAbs: string,
): Promise<{
  master: { png: string; width: number; height: number };
  variants: Record<string, { webp: string; avif: string; width: number; height: number }>;
}> {
  await mkdir(outDirAbs, { recursive: true });

  const meta = await sharp(master).metadata();
  const masterName = 'master.png';
  const masterAbs = path.join(outDirAbs, masterName);
  // Store the high-res master exactly once.
  if (!(await exists(masterAbs))) {
    await writeFile(masterAbs, master);
  }

  const variants: Record<string, { webp: string; avif: string; width: number; height: number }> = {};
  for (const spec of DERIVED) {
    const base = `${spec.width}x${spec.height}`;
    const webpName = `${base}.webp`;
    const avifName = `${base}.avif`;
    const webpAbs = path.join(outDirAbs, webpName);
    const avifAbs = path.join(outDirAbs, avifName);

    // Deterministic outputs; no runtime resizing.
    const img = sharp(master).resize(spec.width, spec.height, { fit: 'cover', position: 'attention' });

    if (!(await exists(webpAbs))) {
      await img.clone().webp({ quality: 82 }).toFile(webpAbs);
    }
    if (!(await exists(avifAbs))) {
      await img.clone().avif({ quality: 55 }).toFile(avifAbs);
    }

    variants[base] = { webp: webpName, avif: avifName, width: spec.width, height: spec.height };
  }

  return {
    master: { png: masterName, width: meta.width ?? 0, height: meta.height ?? 0 },
    variants,
  };
}

function publicUrlFor(siteKey: string, kind: 'hero' | 'category', assetSlug: string, filename: string) {
  return `/assets/ai/${kind}/${encodeURIComponent(siteKey)}/${encodeURIComponent(assetSlug)}/${filename}`;
}

async function ensureAutomationRow(siteKey: string) {
  return await prisma.automationConfig.upsert({
    where: { siteKey },
    create: { siteKey },
    update: {},
  });
}

export async function generateHeroImage(params: { siteKey: string; force?: boolean }) {
  const site = await getSiteByKey(params.siteKey);
  const siteName = site?.name ?? params.siteKey;
  const tone = site?.overrides?.heroTone ?? 'neutral';

  const cfg = await ensureAutomationRow(params.siteKey);
  const force = Boolean(params.force) || Boolean(cfg.heroRegenerateAt);
  if (!cfg.imageGenEnabled && !force) {
    return { ok: true as const, skipped: true as const, reason: 'imageGenEnabled=false' };
  }

  const prompt = heroPrompt({ siteName, tone });
  const promptHash = sha256Hex(`${PROMPT_VERSION}:${prompt}`);
  const bannerKey = `hero-background:${params.siteKey}`;
  const existing = await prisma.banner.findUnique({ where: { key: bannerKey } });

  const assetSlug = 'hero';
  const outDirAbs = path.join(assetsRootDirFromWorkerCwd(), 'hero', params.siteKey, assetSlug);

  const expectedWebp = path.join(outDirAbs, '1920x1080.webp');
  const sameHash = (existing?.imageSet as any)?.promptHash === promptHash;

  if (!force && existing?.imageUrl && sameHash && (await exists(expectedWebp))) {
    await prisma.aIActionLog.create({
      data: {
        role: 'HERO_IMAGE_GENERATOR',
        status: 'SUCCESS',
        startedAt: new Date(),
        finishedAt: new Date(),
        promptVersion: PROMPT_VERSION,
        model: process.env.AI_IMAGE_MODEL ?? 'dall-e-3',
        outputPreview: existing.imageUrl,
        metadata: { siteKey: params.siteKey, skipped: true, reason: 'cached', promptHash },
        entityType: 'HERO',
        actionType: 'ROTATE',
      },
    });
    return { ok: true as const, skipped: true as const, reason: 'cached' };
  }

  const model = process.env.AI_IMAGE_MODEL ?? 'dall-e-3';
  const startedAt = new Date();
  const log = await prisma.aIActionLog.create({
    data: {
      role: 'HERO_IMAGE_GENERATOR',
      status: 'FAILURE',
      startedAt,
      promptVersion: PROMPT_VERSION,
      model,
      metadata: { siteKey: params.siteKey, promptHash, force },
      entityType: 'HERO',
      actionType: 'ROTATE',
    },
  });

  try {
    // 1792x1024 is the closest native 16:9 option.
    const masterUrl = await generatePromoImage({ model, prompt, size: '1792x1024' });
    const master = await downloadToBuffer(masterUrl);
    const rendered = await renderDerived(master, outDirAbs);

    const urls: Record<string, any> = {
      promptHash,
      promptVersion: PROMPT_VERSION,
      master: {
        png: publicUrlFor(params.siteKey, 'hero', assetSlug, rendered.master.png),
        sourceUrl: masterUrl,
      },
      variants: Object.fromEntries(
        Object.entries(rendered.variants).map(([k, v]) => [
          k,
          {
            webp: publicUrlFor(params.siteKey, 'hero', assetSlug, v.webp),
            avif: publicUrlFor(params.siteKey, 'hero', assetSlug, v.avif),
            width: v.width,
            height: v.height,
          },
        ]),
      ),
    };

    const canonicalImageUrl = urls.variants['1920x1080']?.webp ?? urls.master.png;

    await prisma.banner.upsert({
      where: { key: bannerKey },
      create: {
        key: bannerKey,
        title: 'Hero background',
        category: null,
        imageUrl: canonicalImageUrl,
        imageSet: urls,
        enabled: true,
        source: 'AI',
      },
      update: {
        title: 'Hero background',
        imageUrl: canonicalImageUrl,
        imageSet: urls,
        enabled: true,
        source: 'AI',
      },
    });

    if (cfg.heroRegenerateAt) {
      await prisma.automationConfig.update({
        where: { siteKey: params.siteKey },
        data: { heroRegenerateAt: null },
      });
    }

    await prisma.aIActionLog.update({
      where: { id: log.id },
      data: { status: 'SUCCESS', finishedAt: new Date(), outputPreview: canonicalImageUrl, metadata: { ...urls, siteKey: params.siteKey } },
    });

    return { ok: true as const, skipped: false as const, imageUrl: canonicalImageUrl };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.aIActionLog.update({
      where: { id: log.id },
      data: { status: 'FAILURE', finishedAt: new Date(), error: message },
    });
    throw e;
  }
}

export async function generateCategoryImages(params: { siteKey: string; force?: boolean; limit?: number }) {
  const site = await getSiteByKey(params.siteKey);
  const siteName = site?.name ?? params.siteKey;

  const cfg = await ensureAutomationRow(params.siteKey);
  const force = Boolean(params.force) || Boolean(cfg.categoryRegenerateAt);
  if (!cfg.imageGenEnabled && !force) {
    return { ok: true as const, skipped: true as const, reason: 'imageGenEnabled=false' };
  }

  const limit = params.limit ?? 12;

  const categoryCandidates =
    site?.defaultCategories?.length ? site.defaultCategories : (await prisma.product.findMany({
      where: { blocked: false, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      take: limit * 3,
    })).map((r) => r.category).filter((c): c is string => typeof c === 'string' && c.length > 0);

  const categories = Array.from(new Set(categoryCandidates)).slice(0, limit);
  const model = process.env.AI_IMAGE_MODEL ?? 'dall-e-3';

  const startedAt = new Date();
  const log = await prisma.aIActionLog.create({
    data: {
      role: 'CATEGORY_IMAGE_GENERATOR',
      status: 'FAILURE',
      startedAt,
      promptVersion: PROMPT_VERSION,
      model,
      metadata: { siteKey: params.siteKey, force, categories },
      entityType: 'SEO',
      actionType: 'FINALIZE',
    },
  });

  try {
    const results: Array<{ category: string; imageUrl: string; skipped: boolean }> = [];
    for (const category of categories) {
      const prompt = categoryPrompt({ siteName, category });
      const promptHash = sha256Hex(`${PROMPT_VERSION}:${prompt}`);

      const bannerKey = `category-banner:${params.siteKey}:${safeSeg(category)}`;
      const existing = await prisma.banner.findUnique({ where: { key: bannerKey } });

      const assetSlug = safeSeg(category) || 'category';
      const outDirAbs = path.join(assetsRootDirFromWorkerCwd(), 'category', params.siteKey, assetSlug);
      const expectedWebp = path.join(outDirAbs, '1200x600.webp');
      const sameHash = (existing?.imageSet as any)?.promptHash === promptHash;

      if (!force && existing?.imageUrl && sameHash && (await exists(expectedWebp))) {
        results.push({ category, imageUrl: existing.imageUrl, skipped: true });
        continue;
      }

      const masterUrl = await generatePromoImage({ model, prompt, size: '1792x1024' });
      const master = await downloadToBuffer(masterUrl);
      const rendered = await renderDerived(master, outDirAbs);

      const urls: Record<string, any> = {
        promptHash,
        promptVersion: PROMPT_VERSION,
        master: {
          png: publicUrlFor(params.siteKey, 'category', assetSlug, rendered.master.png),
          sourceUrl: masterUrl,
        },
        variants: Object.fromEntries(
          Object.entries(rendered.variants).map(([k, v]) => [
            k,
            {
              webp: publicUrlFor(params.siteKey, 'category', assetSlug, v.webp),
              avif: publicUrlFor(params.siteKey, 'category', assetSlug, v.avif),
              width: v.width,
              height: v.height,
            },
          ]),
        ),
      };

      const canonicalImageUrl = urls.variants['1200x600']?.webp ?? urls.master.png;

      await prisma.banner.upsert({
        where: { key: bannerKey },
        create: {
          key: bannerKey,
          title: `${category} banner`,
          category,
          imageUrl: canonicalImageUrl,
          imageSet: urls,
          enabled: true,
          source: 'AI',
        },
        update: {
          title: `${category} banner`,
          category,
          imageUrl: canonicalImageUrl,
          imageSet: urls,
          enabled: true,
          source: 'AI',
        },
      });

      results.push({ category, imageUrl: canonicalImageUrl, skipped: false });
    }

    if (cfg.categoryRegenerateAt) {
      await prisma.automationConfig.update({
        where: { siteKey: params.siteKey },
        data: { categoryRegenerateAt: null },
      });
    }

    await prisma.aIActionLog.update({
      where: { id: log.id },
      data: { status: 'SUCCESS', finishedAt: new Date(), outputPreview: results.slice(0, 5).map((r) => r.category).join(', '), metadata: { siteKey: params.siteKey, results } },
    });

    return { ok: true as const, skipped: false as const, results };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.aIActionLog.update({
      where: { id: log.id },
      data: { status: 'FAILURE', finishedAt: new Date(), error: message },
    });
    throw e;
  }
}

