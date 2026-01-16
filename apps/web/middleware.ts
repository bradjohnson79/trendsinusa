import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { ADMIN_SESSION_COOKIE, getAdminSessionSecret, verifyAdminSession } from '@/src/lib/adminSession';

function unauthorized(): NextResponse {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="trendsinusa admin"',
    },
  });
}

async function hasValidSessionCookie(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const secret = getAdminSessionSecret();
  if (!token || !secret) return false;
  return (await verifyAdminSession(token, secret)) !== null;
}

function hasValidBasicAuth(req: NextRequest): boolean {
  const user = process.env.ADMIN_BASIC_AUTH_USER;
  const pass = process.env.ADMIN_BASIC_AUTH_PASSWORD;
  if (!user || !pass) return false;

  const header = req.headers.get('authorization');
  if (!header?.startsWith('Basic ')) return false;

  try {
    const decoded = atob(header.slice('Basic '.length));
    const [u, p] = decoded.split(':');
    return u === user && p === pass;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Ensure deterministic A/B assignment (no flicker). We set a stable cookie once.
  const res = NextResponse.next();
  if (!req.cookies.get('tui_ab')?.value) {
    res.cookies.set('tui_ab', crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  if (!pathname.startsWith('/admin')) return res;

  // Allow unauthenticated access to the login route itself.
  if (pathname.startsWith('/admin/login')) return NextResponse.next();
  if (pathname.startsWith('/admin/logout')) return NextResponse.next();

  // Prefer session cookie. Keep Basic Auth as an emergency fallback (opt-in via env).
  // If neither method is configured/valid, block access by default.
  // This prevents accidental public exposure.
  if (await hasValidSessionCookie(req)) return res;
  if (hasValidBasicAuth(req)) return res;

  // Redirect to login unless the client is trying Basic Auth (in which case return 401 challenge).
  const wantsBasic = req.headers.get('authorization')?.startsWith('Basic ');
  if (wantsBasic) return unauthorized();

  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/:path*'],
};

