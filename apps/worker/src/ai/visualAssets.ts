/**
 * Permanent policy: no external image generation APIs.
 *
 * This module previously generated decorative site assets via OpenAI Images.
 * It is now disabled (fail-closed) to prevent any authenticated image usage.
 */

export async function generateHeroImage() {
  return { ok: false as const, error: 'image_generation_disabled' };
}

export async function generateCategoryImages() {
  return { ok: false as const, error: 'image_generation_disabled' };
}
