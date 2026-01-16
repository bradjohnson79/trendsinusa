import 'server-only';

import { prisma } from '@/src/server/prisma';

export type AutomationConfigView = {
  siteKey: string;
  imageGenEnabled: boolean;
  heroRegenerateAt: Date | null;
  categoryRegenerateAt: Date | null;
};

export async function getAutomationConfig(siteKey: string): Promise<AutomationConfigView> {
  const row = await prisma.automationConfig.findUnique({ where: { siteKey } });
  if (!row) {
    return { siteKey, imageGenEnabled: false, heroRegenerateAt: null, categoryRegenerateAt: null };
  }
  return {
    siteKey: row.siteKey,
    imageGenEnabled: row.imageGenEnabled,
    heroRegenerateAt: row.heroRegenerateAt,
    categoryRegenerateAt: row.categoryRegenerateAt,
  };
}

export async function setImageGenEnabled(siteKey: string, enabled: boolean) {
  await prisma.automationConfig.upsert({
    where: { siteKey },
    create: { siteKey, imageGenEnabled: enabled },
    update: { imageGenEnabled: enabled },
  });
}

export async function requestHeroRegenerate(siteKey: string) {
  await prisma.automationConfig.upsert({
    where: { siteKey },
    create: { siteKey, heroRegenerateAt: new Date() },
    update: { heroRegenerateAt: new Date() },
  });
}

export async function requestCategoryRegenerate(siteKey: string) {
  await prisma.automationConfig.upsert({
    where: { siteKey },
    create: { siteKey, categoryRegenerateAt: new Date() },
    update: { categoryRegenerateAt: new Date() },
  });
}

