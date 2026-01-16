'use server';

import { upsertGaConfig } from '@/src/server/analytics/config';

function normMeasurementId(input: string | null): string | null {
  const v = (input ?? '').trim();
  if (!v) return null;
  return v;
}

export async function saveGa4Config(formData: FormData) {
  const siteKey = String(formData.get('siteKey') ?? '').trim();
  const enabled = String(formData.get('enabled') ?? '') === 'on';
  const measurementId = normMeasurementId(formData.get('gaMeasurementId') ? String(formData.get('gaMeasurementId')) : null);

  if (!siteKey) throw new Error('Missing siteKey');
  await upsertGaConfig({ siteKey, enabled, measurementId });
}

