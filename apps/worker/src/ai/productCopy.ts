/**
 * Permanent policy: no sales/creative product copy generation.
 *
 * This module previously regenerated product copy in batches.
 * It is now disabled (fail-closed) per cost-driven AI rules.
 */

export async function runBatchRegenerateStaleProducts(_params: { limit: number }) {
  return [] as Array<{ ok: true; skipped: true; reason: 'ai_policy_disabled' }>;
}
