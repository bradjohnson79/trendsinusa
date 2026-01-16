import 'server-only';

import { prisma } from '@/src/server/prisma';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getActiveHero() {
  const today = startOfToday();
  return await prisma.heroRotation.findFirst({
    where: { forDate: { gte: today } },
    orderBy: { forDate: 'desc' },
  });
}

export async function getHeroHistory(limit = 7) {
  return await prisma.heroRotation.findMany({
    orderBy: { forDate: 'desc' },
    take: limit,
  });
}

