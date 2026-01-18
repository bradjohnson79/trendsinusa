import { prisma } from '@trendsinusa/db';

/**
 * Global ingestion kill switch.
 *
 * Default is FAIL-CLOSED:
 * - If there is no row, ingestion is disabled.
 * - Callers must explicitly enable ingestionEnabled to allow any ingestion writes.
 */
export async function requireIngestionEnabled(params: { siteKey: string }) {
  const gate = await (prisma as any).automationGate
    .findUnique({ where: { siteKey: params.siteKey }, select: { ingestionEnabled: true } })
    .catch(() => null);
  if (!gate?.ingestionEnabled) {
    throw new Error('ingestion_disabled: AutomationGate.ingestionEnabled=false');
  }
}

export async function isAutoPublishEnabled(params: { siteKey: string }) {
  const gate = await (prisma as any).automationGate
    .findUnique({ where: { siteKey: params.siteKey }, select: { autoPublishEnabled: true } })
    .catch(() => null);
  return Boolean(gate?.autoPublishEnabled);
}

export async function requireAutoPublishEnabled(params: { siteKey: string }) {
  const ok = await isAutoPublishEnabled(params);
  if (!ok) throw new Error('auto_publish_disabled: AutomationGate.autoPublishEnabled=false');
}

/**
 * Phase U publishing gate (unaffiliated posts).
 * Default is FAIL-CLOSED:
 * - If there is no row, unaffiliated auto-publishing is disabled.
 * - Admin must explicitly enable unaffiliatedAutoPublishEnabled.
 */
export async function isUnaffiliatedAutoPublishEnabled(params: { siteKey: string }) {
  const gate = await (prisma as any).automationGate
    .findUnique({ where: { siteKey: params.siteKey }, select: { unaffiliatedAutoPublishEnabled: true } })
    .catch(() => null);
  return Boolean(gate?.unaffiliatedAutoPublishEnabled);
}

