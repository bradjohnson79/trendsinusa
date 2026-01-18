import { prisma } from '@trendsinusa/db';
import { getServerEnv } from '@trendsinusa/shared';
import { startAutomationScheduleRuntime } from './scheduler/automationScheduleRuntime.js';

const env = getServerEnv();

async function main() {
  // Basic startup check: ensure DB client can be constructed.
  // (Actual DB connectivity is exercised once models/migrations exist.)
  void prisma;

  // Dynamic schedules (fail-closed: no schedules enabled by default).
  await startAutomationScheduleRuntime({ siteKey: process.env.SITE_KEY ?? 'trendsinusa' });

  // eslint-disable-next-line no-console
  console.log(`[worker] initialized (logLevel=${env.WORKER_LOG_LEVEL}) (automation schedules active)`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[worker] fatal', err);
  process.exitCode = 1;
});

