import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());

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

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function isCodeFile(p) {
  return p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js') || p.endsWith('.jsx') || p.endsWith('.mjs') || p.endsWith('.cjs');
}

function rel(p) {
  return path.relative(ROOT, p);
}

function matchImports(text) {
  // Good-enough regex for our repo conventions.
  // Catches: import ... from 'x';  import('x');  require('x')
  const rx = /\bfrom\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const out = [];
  for (let m; (m = rx.exec(text)); ) {
    out.push(m[1] || m[2] || m[3]);
  }
  return out;
}

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
}

function checkNoForbiddenImports({ rootDir, forbid, label }) {
  const abs = path.join(ROOT, rootDir);
  if (!fs.existsSync(abs)) return;
  const files = walk(abs).filter(isCodeFile);
  for (const f of files) {
    // Allow explicit server-only entrypoints under packages/shared/src/server/**
    if (label === 'packages/shared' && rel(f).includes('packages/shared/src/server/')) continue;
    if (label === 'packages/shared' && rel(f) === 'packages/shared/src/server.ts') continue;
    const imports = matchImports(readText(f));
    for (const spec of imports) {
      for (const rule of forbid) {
        const hit =
          rule.type === 'exact'
            ? spec === rule.value
            : rule.type === 'prefix'
              ? spec.startsWith(rule.value)
              : rule.type === 'contains'
                ? spec.includes(rule.value)
                : rule.type === 'regex'
                  ? rule.value.test(spec)
                  : false;
        if (hit) {
          fail(`[boundaries] ${label}: forbidden import in ${rel(f)} -> "${spec}"`);
        }
      }
    }
  }
}

// apps/web is Vercel-deployed frontend (includes /admin routes today).
// It must never import Prisma/db/worker/scheduler logic.
checkNoForbiddenImports({
  rootDir: 'apps/web/src',
  label: 'apps/web',
  forbid: [
    { type: 'exact', value: '@trendsinusa/db' },
    { type: 'exact', value: '@prisma/client' },
    { type: 'contains', value: '/apps/worker/' },
    { type: 'contains', value: 'apps/worker' },
    { type: 'contains', value: 'scheduler/automationScheduleRuntime' },
    { type: 'prefix', value: 'node:' }, // no node builtins in browser bundle
    { type: 'exact', value: 'fs' },
    { type: 'exact', value: 'child_process' },
  ],
});

// packages/* are shared libs only (no DB + no worker/app imports).
checkNoForbiddenImports({
  rootDir: 'packages/shared/src',
  label: 'packages/shared',
  forbid: [
    { type: 'exact', value: '@trendsinusa/db' },
    { type: 'exact', value: '@prisma/client' },
    { type: 'contains', value: '/apps/' },
    { type: 'contains', value: 'apps/' },
    { type: 'exact', value: 'dotenv' },
    { type: 'prefix', value: 'node:' }, // keep shared package runtime-neutral
  ],
});

if (process.exitCode) process.exit(process.exitCode);
console.log('[boundaries] OK');

