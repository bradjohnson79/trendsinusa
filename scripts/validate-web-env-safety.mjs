import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const WEB_SRC = path.join(ROOT, 'apps', 'web', 'src');

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.turbo', '.git']);

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    if (IGNORED_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function isCodeFile(p) {
  return p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js') || p.endsWith('.jsx');
}

function rel(p) {
  return path.relative(ROOT, p);
}

const FORBIDDEN_TOKENS = [
  'OPENAI_API_KEY',
  'PERPLEXITY_API_KEY',
  'DATABASE_URL',
  'DATABASE_DIRECT_URL',
  'ADMIN_SESSION_SECRET',
  'AMAZON_ACCESS_KEY',
  'AMAZON_SECRET_KEY',
  'AMAZON_ASSOCIATE_TAG',
  'GITHUB_PAT',
  'process.env',
];

let bad = 0;
if (!fs.existsSync(WEB_SRC)) {
  console.log('[web-env-safety] skipped (apps/web/src not found)');
  process.exit(0);
}

for (const f of walk(WEB_SRC).filter(isCodeFile)) {
  const txt = fs.readFileSync(f, 'utf8');
  for (const token of FORBIDDEN_TOKENS) {
    if (txt.includes(token)) {
      console.error(`[web-env-safety] forbidden reference in ${rel(f)} -> ${token}`);
      bad++;
    }
  }
}

if (bad) process.exit(1);
console.log('[web-env-safety] OK');

