const GENERIC = '/placeholders/generic.png';

function norm(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministic category → placeholder mapping.
 * Always returns a valid URL under `/public/placeholders/`.
 */
export function placeholderForCategory(category: string | null | undefined): string {
  const c = norm(category || '');
  if (!c) return GENERIC;

  if (c.includes('kitchen') || c.includes('cook') || c.includes('appliance')) return '/placeholders/kitchen.png';
  if (c.includes('elect') || c.includes('computer') || c.includes('audio') || c.includes('camera')) return '/placeholders/electronics.png';
  if (c.includes('home') || c.includes('furniture') || c.includes('bed') || c.includes('bath')) return '/placeholders/home.png';
  if (c.includes('security') || c.includes('camera') || c.includes('lock') || c.includes('alarm')) return '/placeholders/security.png';
  if (c.includes('climate') || c.includes('hvac') || c.includes('heater') || c.includes('air') || c.includes('fan')) return '/placeholders/climate-control.png';

  return GENERIC;
}

export const genericPlaceholderUrl = GENERIC;

