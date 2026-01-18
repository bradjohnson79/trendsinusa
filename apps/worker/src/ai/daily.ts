/**
 * Permanent policy: no long-form or creative copy generation.
 *
 * This module previously generated marketing-style site copy and images.
 * It is now disabled (fail-closed) per cost-driven AI rules.
 */

export async function runDailyHeroHeadlineWriter() {
  return { ok: true as const, skipped: true as const, reason: 'ai_policy_disabled' };
}

export async function runDailyBannerTextWriterAndImage() {
  return [] as Array<{ ok: true; skipped: true; reason: 'ai_policy_disabled' }>;
}

export async function runDailyDealMicroCopyWriter() {
  return [] as Array<{ ok: true; skipped: true; reason: 'ai_policy_disabled' }>;
}
