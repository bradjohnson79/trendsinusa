import 'server-only';

import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';

export type Variant<T extends readonly string[]> = T[number];

export async function getAbId(): Promise<string> {
  const c = await cookies();
  return c.get('tui_ab')?.value ?? 'missing';
}

export function chooseVariant<const T extends readonly string[]>(
  experiment: string,
  variants: T,
  abId: string,
): Variant<T> {
  // Deterministic: hash(abId + experiment) and mod by variants length.
  const h = createHash('sha256').update(`${abId}:${experiment}`).digest();
  const n = h.readUInt32BE(0);
  const idx = n % variants.length;
  return variants[idx] as Variant<T>;
}

