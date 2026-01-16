import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getAdminProductDetail } from '@/src/server/admin/products';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ asin: string }> }) {
  const { asin: raw } = await ctx.params;
  const asin = decodeURIComponent(raw);
  const detail = await getAdminProductDetail(asin);
  if (!detail) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, ...detail });
}

