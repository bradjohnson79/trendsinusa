import type { JobName } from '@trendsinusa/shared';
import type { IngestionSource } from '@prisma/client';

import { fetchSeedIngestionPayload } from '../ingestion/sources/seed.js';
import { runIngestion } from '../ingestion/pipeline.js';
import { recomputeProductSiteTags } from '../sites/router.js';

const jobs: JobName[] = ['hourly:refresh-trends'];

export async function runHourlyJobs(): Promise<void> {
  void jobs;

  // Phase 2.1: seeded ingestion to exercise deal lifecycle and admin metrics.
  const source: IngestionSource = 'MANUAL';
  const payload = await fetchSeedIngestionPayload();
  await runIngestion({ source, payload });

  // Phase 5.1: configuration-driven vertical replication.
  // Core ingestion is unchanged; we route products/deals to sites via Product.tags (site:<key>).
  await recomputeProductSiteTags();
}

