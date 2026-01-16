import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { ADMIN_SESSION_COOKIE, getAdminSessionSecret, signAdminSession } from '@/src/lib/adminSession';

function unauthorized(): NextResponse {
  return new NextResponse('Unauthorized', { status: 401 });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const username = String(form.get('username') ?? '');
  const password = String(form.get('password') ?? '');

  const expectedUser = process.env.ADMIN_BASIC_AUTH_USER ?? '';
  const expectedPass = process.env.ADMIN_BASIC_AUTH_PASSWORD ?? '';
  const secret = getAdminSessionSecret();

  if (!expectedUser || !expectedPass || !secret) return unauthorized();
  if (username !== expectedUser || password !== expectedPass) return unauthorized();

  const token = await signAdminSession(username, secret);
  const isProd = process.env.NODE_ENV === 'production';

  const res = NextResponse.redirect(new URL('/admin', req.url));
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/admin',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

