import { prisma } from '@trendsinusa/db';

import { runUnaffiliatedPostGeneration } from '../jobs/unaffiliatedPosts.js';

async function main() {
  const limitRaw = Number(process.env.UNAFFILIATED_POSTS_LIMIT ?? 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.trunc(limitRaw))) : 10;

  const res = await runUnaffiliatedPostGeneration({ limit });
  // eslint-disable-next-line no-console
  console.log('[unaffiliated-posts]', res);
}

void main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error('[unaffiliated-posts] FAILURE', e);
    process.exitCode = 1;
    await prisma.$disconnect();
  });

