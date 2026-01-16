'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/src/server/prisma';

const CORE_TAGS = new Set(['evergreen', 'seasonal', 'impulse', 'suppressed']);

function audit(message: string) {
  // Append-only audit stream using SystemAlert; noisy so it doesn't pollute ops alerts.
  return prisma.systemAlert.create({ data: { type: 'SYSTEM', severity: 'INFO', noisy: true, message } });
}

function normalizeAsin(v: unknown): string {
  return String(v ?? '').trim();
}

export async function setProductBlocked(params: { asin: string; blocked: boolean; reason?: string }) {
  const asin = normalizeAsin(params.asin);
  if (!asin) return;
  await prisma.product.update({ where: { asin }, data: { blocked: params.blocked } });
  await audit(`audit:product asin=${asin} action=${params.blocked ? 'suppress' : 'unsuppress'} reason=${(params.reason ?? '').trim() || 'none'}`);
  revalidatePath('/admin/products');
}

export async function setProductCategoryOverride(params: { asin: string; categoryOverride: string | null; reason?: string }) {
  const asin = normalizeAsin(params.asin);
  if (!asin) return;
  const raw = (params.categoryOverride ?? '').trim();
  const value = raw.length ? raw : null;
  await prisma.product.update({ where: { asin }, data: { categoryOverride: value } });
  await audit(`audit:product asin=${asin} action=category_override value=${value ?? 'null'} reason=${(params.reason ?? '').trim() || 'none'}`);
  revalidatePath('/admin/products');
}

export async function setProductCoreTags(params: { asin: string; tags: Array<'evergreen' | 'seasonal' | 'impulse'>; reason?: string }) {
  const asin = normalizeAsin(params.asin);
  if (!asin) return;
  const p = await prisma.product.findUnique({ where: { asin }, select: { tags: true, blocked: true } });
  if (!p) return;

  const preserved = p.tags.filter((t) => !CORE_TAGS.has(t)); // keep site/geo/topic/etc
  const next = Array.from(new Set([...preserved, ...params.tags]));
  await prisma.product.update({ where: { asin }, data: { tags: next } });
  await audit(`audit:product asin=${asin} action=tags core=${params.tags.join(',') || 'none'} reason=${(params.reason ?? '').trim() || 'none'}`);
  revalidatePath('/admin/products');
}

export async function setProductSiteEligibility(params: { asin: string; siteKeys: string[]; reason?: string }) {
  const asin = normalizeAsin(params.asin);
  if (!asin) return;
  const p = await prisma.product.findUnique({ where: { asin }, select: { tags: true } });
  if (!p) return;

  const preserved = p.tags.filter((t) => !t.startsWith('site:'));
  const siteTags = params.siteKeys.map((k) => `site:${k}`).filter(Boolean);
  const next = Array.from(new Set([...preserved, ...siteTags]));
  await prisma.product.update({ where: { asin }, data: { tags: next } });
  await audit(`audit:product asin=${asin} action=site_eligibility sites=${params.siteKeys.join(',') || 'none'} reason=${(params.reason ?? '').trim() || 'none'}`);
  revalidatePath('/admin/products');
}

