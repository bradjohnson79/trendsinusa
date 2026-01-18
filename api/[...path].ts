// Vercel Serverless Function entrypoint (single-project deploy).
// Delegates to the existing API router in apps/api.
//
// NOTE: apps/api/src/index.ts must not auto-listen when VERCEL=1.
// We import the built API handler to avoid TS/ESM extension resolution issues in serverless bundling.
import { handle } from '../apps/api/dist/index.js';

export default async function vercelHandler(req: any, res: any) {
  try {
    await handle(req, res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'internal_error', message: msg }));
  }
}

