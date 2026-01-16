import { prisma } from '@trendsinusa/db';
import { getServerEnv } from '@trendsinusa/shared';

import { runDailyJobs } from './jobs/daily.js';
import { runHourlyJobs } from './jobs/hourly.js';

const env = getServerEnv();

async function main() {
  // Basic startup check: ensure DB client can be constructed.
  // (Actual DB connectivity is exercised once models/migrations exist.)
  void prisma;

  // Placeholder scheduling: wire these into a real scheduler later (cron, queue, etc).
  await runHourlyJobs();
  await runDailyJobs();

  // eslint-disable-next-line no-console
  console.log(`[worker] initialized (logLevel=${env.WORKER_LOG_LEVEL})`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[worker] fatal', err);
  process.exitCode = 1;
});

