'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getServerEnv } from '@trendsinusa/shared';
import { prisma } from '@/src/server/prisma';

async function getAdminSelectedSiteKey(): Promise<string> {
  const env = getServerEnv();
  const store = await cookies();
  return store.get('tui_admin_site')?.value ?? env.SITE_KEY;
}

async function rateLimitCommand(siteKey: string, type: 'AMAZON_PRODUCTS_REFRESH' | 'AMAZON_DEALS_REFRESH') {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const recent = await prisma.systemCommand.findFirst({
    where: { siteKey, type, requestedAt: { gte: since } },
    orderBy: { requestedAt: 'desc' },
    select: { id: true, requestedAt: true },
  });
  if (recent) throw new Error('Rate limited: refresh already requested recently.');
}

export async function requestAmazonProductsRefresh() {
  const siteKey = await getAdminSelectedSiteKey();
  await rateLimitCommand(siteKey, 'AMAZON_PRODUCTS_REFRESH');
  await prisma.systemCommand.create({
    data: { siteKey, type: 'AMAZON_PRODUCTS_REFRESH', status: 'STARTED', metadata: { requestedBy: 'admin' } as any },
  });
  revalidatePath('/admin/system-logs');
}

export async function requestAmazonDealsRefresh() {
  const siteKey = await getAdminSelectedSiteKey();
  await rateLimitCommand(siteKey, 'AMAZON_DEALS_REFRESH');
  await prisma.systemCommand.create({
    data: { siteKey, type: 'AMAZON_DEALS_REFRESH', status: 'STARTED', metadata: { requestedBy: 'admin' } as any },
  });
  revalidatePath('/admin/system-logs');
}

export async function setDealApproved(formData: FormData) {
  const dealId = String(formData.get('dealId') ?? '').trim();
  const approved = formData.get('approved') === 'on';
  if (!dealId) return;
  await prisma.deal.update({ where: { id: dealId }, data: { approved } });
  revalidatePath('/admin/system-logs');
}

export async function setDealSuppressed(formData: FormData) {
  const dealId = String(formData.get('dealId') ?? '').trim();
  const suppressed = formData.get('suppressed') === 'on';
  if (!dealId) return;
  await prisma.deal.update({ where: { id: dealId }, data: { suppressed } });
  revalidatePath('/admin/system-logs');
}

export async function setProductBlocked(formData: FormData) {
  const asin = String(formData.get('asin') ?? '').trim().toUpperCase();
  const blocked = formData.get('blocked') === 'on';
  if (!asin) return;
  await prisma.product.update({ where: { asin }, data: { blocked } });
  revalidatePath('/admin/system-logs');
}

