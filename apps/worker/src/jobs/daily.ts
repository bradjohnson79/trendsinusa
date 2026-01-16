import type { JobName } from '@trendsinusa/shared';

const jobs: JobName[] = ['daily:generate-copy', 'daily:expire-deals'];

export async function runDailyJobs(): Promise<void> {
  // Placeholder: later this will generate AI copy, expire deals, and update content.
  void jobs;
}

