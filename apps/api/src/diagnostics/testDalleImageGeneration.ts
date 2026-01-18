type OpenAiImagesResponse = {
  created?: number;
  data: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
};

import sharp from 'sharp';

function getKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');
  return key;
}

function classifyError(opts: { httpStatus: number; raw: string }) {
  const s = opts.httpStatus;
  const t = opts.raw.toLowerCase();
  if (s === 429 || t.includes('rate limit')) return 'rate_limited' as const;
  if (s === 401 || s === 403) return 'access_denied' as const;
  if (t.includes('billing') || t.includes('insufficient_quota') || t.includes('insufficient quota')) return 'billing' as const;
  if (s >= 400 && s < 500) return 'bad_request' as const;
  return 'unknown' as const;
}

function readU32BE(buf: Buffer, offset: number) {
  return buf.readUInt32BE(offset);
}

function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG signature + IHDR chunk
  if (buf.length < 24) return null;
  const sig = buf.subarray(0, 8);
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!sig.equals(pngSig)) return null;
  // bytes 12..15 should be "IHDR"
  const type = buf.subarray(12, 16).toString('ascii');
  if (type !== 'IHDR') return null;
  const width = readU32BE(buf, 16);
  const height = readU32BE(buf, 20);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function parseJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  // Minimal JPEG SOF parser
  if (buf.length < 4) return null;
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    // SOF0, SOF2 (baseline/progressive)
    if (marker === 0xc0 || marker === 0xc2) {
      const blockLen = buf.readUInt16BE(i + 2);
      if (i + 2 + blockLen > buf.length) return null;
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    // skip marker segment
    const len = buf.readUInt16BE(i + 2);
    if (!len || i + 2 + len > buf.length) return null;
    i += 2 + len;
  }
  return null;
}

function detectImageInfo(buf: Buffer): { format: string | null; width: number | null; height: number | null } {
  const png = parsePngDimensions(buf);
  if (png) return { format: 'png', width: png.width, height: png.height };
  const jpg = parseJpegDimensions(buf);
  if (jpg) return { format: 'jpeg', width: jpg.width, height: jpg.height };
  return { format: null, width: null, height: null };
}

export async function testDalleImageGeneration() {
  const started = Date.now();
  const model = 'gpt-image-1';
  const size = '1024x1024';
  const prompt =
    'Generic product-style image representing wireless over-ear headphones, minimal design, neutral background, no logos, no brand names.';

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        n: 1,
      }),
    });

    const elapsedMs = Date.now() - started;
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      const kind = classifyError({ httpStatus: res.status, raw: text });
      return {
        success: false as const,
        error: { message: `OpenAI Images API error ${res.status}`, httpStatus: res.status, kind, raw: text.slice(0, 2000) || null },
        model,
        size,
        elapsedMs,
        image: null,
        responseMeta: null,
      };
    }

    const data = (JSON.parse(text) as OpenAiImagesResponse) ?? null;
    const item = data?.data?.[0] ?? null;
    const b64 = item?.b64_json ?? null;
    const url = item?.url ?? null;

    let buf: Buffer | null = null;
    if (b64) {
      buf = Buffer.from(String(b64), 'base64');
    } else if (url) {
      // In-memory download only (no disk writes).
      const imgRes = await fetch(String(url));
      if (!imgRes.ok) {
        const t = await imgRes.text().catch(() => '');
        return {
          success: false as const,
          error: { message: `Failed to download image URL (${imgRes.status})`, httpStatus: imgRes.status, kind: classifyError({ httpStatus: imgRes.status, raw: t }), raw: t.slice(0, 2000) || null },
          model,
          size,
          elapsedMs,
          image: null,
          responseMeta: { created: data?.created ?? null, revised_prompt: item?.revised_prompt ?? null },
        };
      }
      const arr = await imgRes.arrayBuffer();
      buf = Buffer.from(arr);
    } else {
      return {
        success: false as const,
        error: { message: 'OpenAI Images API returned neither b64_json nor url', httpStatus: res.status, kind: 'unknown', raw: text.slice(0, 2000) || null },
        model,
        size,
        elapsedMs,
        image: null,
        responseMeta: { created: data?.created ?? null, revised_prompt: item?.revised_prompt ?? null },
      };
    }

    const info = detectImageInfo(buf);

    // Optional (recommended): decode + convert via Sharp in-memory only.
    let sharpOk = false;
    let sharpWidth: number | null = null;
    let sharpHeight: number | null = null;
    let webpBytes: number | null = null;
    try {
      const meta = await sharp(buf).metadata();
      sharpWidth = typeof meta.width === 'number' ? meta.width : null;
      sharpHeight = typeof meta.height === 'number' ? meta.height : null;
      const webp = await sharp(buf).webp({ quality: 80 }).toBuffer();
      webpBytes = webp.length;
      sharpOk = true;
    } catch {
      sharpOk = false;
    }

    return {
      success: true as const,
      error: null,
      model,
      size,
      elapsedMs,
      image: {
        format: info.format,
        width: info.width ?? sharpWidth ?? null,
        height: info.height ?? sharpHeight ?? null,
        bytes: buf.length,
      },
      responseMeta: {
        created: data?.created ?? null,
        revised_prompt: item?.revised_prompt ?? null,
        sharp: { ok: sharpOk, width: sharpWidth, height: sharpHeight, webpBytes },
      },
    };
  } catch (e) {
    const elapsedMs = Date.now() - started;
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return {
      success: false as const,
      error: { message: msg, httpStatus: null, kind: 'unknown', raw: null },
      model,
      size,
      elapsedMs,
      image: null,
      responseMeta: null,
    };
  }
}

