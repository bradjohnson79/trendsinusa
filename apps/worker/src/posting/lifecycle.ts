import type { DiscoveryCandidateRetailer, PostingLifecycleState } from '@prisma/client';
import { prisma } from '@trendsinusa/db';

import { isAutoPublishEnabled, requireIngestionEnabled } from '../ingestion/gate.js';

const ORDER: PostingLifecycleState[] = ['DISCOVERY', 'INGESTED', 'ENRICHED', 'IMAGED', 'READY', 'PUBLISHED'];

function rank(s: PostingLifecycleState) {
  return ORDER.indexOf(s);
}

function allowed(from: PostingLifecycleState, to: PostingLifecycleState) {
  // Explicit state machine: allow only forward progress in the defined lifecycle.
  return rank(to) === rank(from) + 1 || (from === 'DISCOVERY' && to === 'DISCOVERY');
}

async function policyEligibilityForProduct(productId: string): Promise<{ eligible: boolean; reason: string | null }> {
  const min = Number(process.env.AUTO_PUBLISH_MIN_CONFIDENCE ?? 0.85);
  const threshold = Number.isFinite(min) ? Math.max(0, Math.min(1, min)) : 0.85;
  const enr = await prisma.productAIEnrichment
    .findFirst({ where: { productId }, orderBy: { createdAt: 'desc' }, select: { finalSummary: true, confidenceScore: true } })
    .catch(() => null);
  const score = enr?.confidenceScore;
  if (!enr?.finalSummary) return { eligible: false, reason: 'missing_ai_summary' };
  if (!Number.isFinite(score ?? NaN)) return { eligible: false, reason: 'missing_ai_confidence' };
  if ((score as number) < threshold) return { eligible: false, reason: `confidence_below_threshold:${(score as number).toFixed(2)}<${threshold.toFixed(2)}` };
  return { eligible: true, reason: null };
}

export async function ensurePostingItemForDiscovery(params: {
  discoveryCandidateId: string;
  retailer: DiscoveryCandidateRetailer;
  discoveredAt: Date;
  category: string | null;
  confidenceScore: number | null;
}) {
  return await prisma.postingItem.upsert({
    where: { discoveryCandidateId: params.discoveryCandidateId },
    create: {
      discoveryCandidateId: params.discoveryCandidateId,
      retailer: params.retailer,
      discoveredAt: params.discoveredAt,
      category: params.category ?? null,
      confidenceScore: params.confidenceScore ?? null,
      state: 'DISCOVERY',
    },
    update: {
      // keep it "fresh" without changing state
      discoveredAt: params.discoveredAt,
      category: params.category ?? null,
      confidenceScore: params.confidenceScore ?? null,
    },
  });
}

export async function attachProductToPostingItem(params: { discoveryCandidateId: string; productId: string }) {
  // Transition DISCOVERY -> INGESTED only when ingestion is enabled (kill switch respected).
  await requireIngestionEnabled({ siteKey: 'trendsinusa' });

  const item = await prisma.postingItem.findUnique({ where: { discoveryCandidateId: params.discoveryCandidateId } });
  if (!item) throw new Error('posting_item_not_found');
  if (item.productId) return item; // already attached

  if (!allowed(item.state, 'INGESTED')) throw new Error(`invalid_transition:${item.state}->INGESTED`);

  return await prisma.postingItem.update({
    where: { id: item.id },
    data: {
      productId: params.productId,
      state: 'INGESTED',
      ingestedAt: new Date(),
    },
  });
}

export async function transitionPostingItem(params: { id: string; to: PostingLifecycleState }) {
  const item = await prisma.postingItem.findUnique({ where: { id: params.id } });
  if (!item) throw new Error('posting_item_not_found');

  if (params.to === item.state) return item;
  if (!allowed(item.state, params.to)) throw new Error(`invalid_transition:${item.state}->${params.to}`);

  // Kill switch: all post-ingestion steps require ingestionEnabled=true
  if (rank(params.to) >= rank('INGESTED')) {
    await requireIngestionEnabled({ siteKey: 'trendsinusa' });
  }

  const now = new Date();
  const data: any = { state: params.to };
  if (params.to === 'ENRICHED') data.enrichedAt = now;
  if (params.to === 'IMAGED') data.imagedAt = now;
  if (params.to === 'READY') data.readyAt = now;
  if (params.to === 'PUBLISHED') data.publishedAt = now;

  // On READY, compute policy eligibility (best-effort) for later publishing decision.
  if (params.to === 'READY' && item.productId) {
    const pol = await policyEligibilityForProduct(item.productId);
    data.policyEligible = pol.eligible;
    data.policyReason = pol.reason;
  }

  // On PUBLISHED, enforce publish rules (kill switch + approval/policy + autoPublishEnabled).
  if (params.to === 'PUBLISHED') {
    const autoPublish = await isAutoPublishEnabled({ siteKey: 'trendsinusa' });
    if (!autoPublish) throw new Error('auto_publish_disabled: AutomationGate.autoPublishEnabled=false');
    const okToPublish = item.approved || item.policyEligible;
    if (!okToPublish) throw new Error('publish_blocked: requires admin approval or policy threshold');
  }

  return await prisma.postingItem.update({ where: { id: item.id }, data });
}

export async function maybeAdvanceToReadyAndPublish(params: { postingItemId: string }) {
  const item = await prisma.postingItem.findUnique({ where: { id: params.postingItemId } });
  if (!item) return { ok: false as const, error: 'posting_item_not_found' };

  // READY requires ENRICHED + IMAGED
  if (item.state === 'IMAGED' && item.enrichedAt) {
    const ready = await transitionPostingItem({ id: item.id, to: 'READY' }).catch(() => null);
    if (ready && (ready.approved || ready.policyEligible)) {
      // If autoPublish is enabled, allow READY -> PUBLISHED
      await transitionPostingItem({ id: ready.id, to: 'PUBLISHED' }).catch(() => null);
    }
  }

  return { ok: true as const };
}

