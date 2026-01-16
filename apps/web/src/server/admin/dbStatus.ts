import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

const REQUIRED_TABLES = [
  'Product',
  'Deal',
  'AffiliateConfig',
  'Banner',
  'HeroRotation',
  'AIActionLog',
  'IngestionRun',
  'SystemAlert',
  'ClickEvent',
] as const;

const REQUIRED_COLUMNS: Record<string, readonly string[]> = {
  Deal: ['source', 'externalKey', 'suppressed', 'status', 'expiresAt', 'currentPriceCents'],
  Product: ['asin', 'source', 'title'],
  IngestionRun: ['source', 'status', 'startedAt', 'finishedAt', 'productsProcessed', 'dealsProcessed'],
};

export type AdminDbStatus =
  | { status: 'ready' }
  | { status: 'needs_migration'; missingTables: string[]; missingColumns: Record<string, string[]> }
  | { status: 'unreachable'; message: string };

export async function getAdminDbStatus(): Promise<AdminDbStatus> {
  try {
    const found = await prisma.$queryRaw<{ table_name: string }[]>(
      Prisma.sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (${Prisma.join(REQUIRED_TABLES)})
      `,
    );

    const foundSet = new Set(found.map((r) => r.table_name));
    const missingTables = REQUIRED_TABLES.filter((t) => !foundSet.has(t));
    const missingColumns: Record<string, string[]> = {};

    // If tables exist, also verify critical columns to prevent runtime crashes due to schema drift.
    for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
      if (!foundSet.has(table)) continue;
      const rows = await prisma.$queryRaw<{ column_name: string }[]>(
        Prisma.sql`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ${table}
            AND column_name IN (${Prisma.join(cols)})
        `,
      );
      const colSet = new Set(rows.map((r) => r.column_name));
      const missing = cols.filter((c) => !colSet.has(c));
      if (missing.length) missingColumns[table] = [...missing];
    }

    if (missingTables.length > 0 || Object.keys(missingColumns).length > 0) {
      return { status: 'needs_migration', missingTables, missingColumns };
    }

    return { status: 'ready' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown database error';
    return { status: 'unreachable', message: msg };
  }
}

