export const ADMIN_SESSION_COOKIE = 'tui_admin_session';

type SessionPayload = {
  sub: string;
  iat: number;
  exp: number;
};

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa expects latin1
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return out === 0;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(utf8Bytes(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, toArrayBuffer(utf8Bytes(data)));
  return new Uint8Array(sig);
}

export function getAdminSessionSecret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) return null;
  return s;
}

export async function signAdminSession(sub: string, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub,
    iat: now,
    exp: now + 60 * 60 * 24 * 7, // 7 days
  };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = base64UrlEncodeBytes(utf8Bytes(payloadStr));
  const sig = await hmacSha256(secret, payloadB64);
  const sigB64 = base64UrlEncodeBytes(sig);
  return `${payloadB64}.${sigB64}`;
}

export async function verifyAdminSession(
  token: string,
  secret: string,
): Promise<{ sub: string } | null> {
  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = await hmacSha256(secret, payloadB64);
  const gotSig = base64UrlDecodeToBytes(sigB64);
  if (!timingSafeEqual(expectedSig, gotSig)) return null;

  try {
    const payloadJson = bytesToUtf8(base64UrlDecodeToBytes(payloadB64));
    const payload = JSON.parse(payloadJson) as SessionPayload;
    if (!payload || typeof payload.sub !== 'string') return null;
    if (typeof payload.exp !== 'number') return null;
    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

