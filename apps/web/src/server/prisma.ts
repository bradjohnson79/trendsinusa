import 'server-only';

import { prisma as base } from '@trendsinusa/db';

function assertNoDealPriceWrites(data: unknown) {
  const d = data as Record<string, unknown> | null | undefined;
  if (!d || typeof d !== 'object') return;
  const forbidden = ['currentPriceCents', 'oldPriceCents', 'discountPercent', 'currency'];
  if (forbidden.some((k) => Object.prototype.hasOwnProperty.call(d, k))) {
    throw new Error('Compliance: manual deal price edits are forbidden (worker-only).');
  }
}

// Compliance safeguard: prevent manual price edits from the web app via Prisma query extensions.
export const prisma = base.$extends({
  query: {
    deal: {
      create({ args, query }) {
        assertNoDealPriceWrites((args as { data?: unknown })?.data);
        return query(args);
      },
      update({ args, query }) {
        assertNoDealPriceWrites((args as { data?: unknown })?.data);
        return query(args);
      },
      updateMany({ args, query }) {
        assertNoDealPriceWrites((args as { data?: unknown })?.data);
        return query(args);
      },
      upsert({ args, query }) {
        const a = args as { create?: { [k: string]: unknown }; update?: { [k: string]: unknown } };
        assertNoDealPriceWrites(a?.create);
        assertNoDealPriceWrites(a?.update);
        return query(args);
      },
    },
  },
});

