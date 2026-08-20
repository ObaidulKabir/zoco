#!/usr/bin/env node
/**
 * Sprint 0 exit: ESLint boundaries must fail a deliberate domain → infrastructure import.
 */
const { execSync } = require('node:child_process');
const { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const repoRoot = join(__dirname, '..');
const domainDir = join(repoRoot, 'apps/api/src/modules/identity/domain');
const probe = join(domainDir, '_boundary_probe.ts');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.next', 'coverage', '.git'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (full.endsWith('.ts') && !full.endsWith('.spec.ts')) acc.push(full);
  }
  return acc;
}

function realLeaks() {
  const hits = [];
  for (const dir of ['apps/api/src/modules', 'packages'].map((p) => join(repoRoot, p))) {
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      if (!file.replace(/\\/g, '/').includes('/domain/')) continue;
      const text = readFileSync(file, 'utf8');
      if (/from ['"][^'"]*infrastructure[^'"]*['"]/.test(text)) {
        hits.push(relative(repoRoot, file));
      }
    }
  }
  return hits;
}

const leaks = realLeaks();
if (leaks.length) {
  console.error('Domain layer already imports infrastructure:\n' + leaks.join('\n'));
  process.exit(1);
}

mkdirSync(domainDir, { recursive: true });
writeFileSync(
  probe,
  `import { InMemoryUserStore } from '../infrastructure/persistence/in-memory-user-store';\nexport const leak = InMemoryUserStore;\n`,
);

const candidates = [
  join(repoRoot, 'apps/api/node_modules/.bin/eslint.cmd'),
  join(repoRoot, 'apps/api/node_modules/.bin/eslint'),
  join(repoRoot, 'node_modules/.bin/eslint.cmd'),
  join(repoRoot, 'node_modules/.bin/eslint'),
];
const eslintBin = candidates.find((p) => existsSync(p));
const eslintCmd = eslintBin ? `"${eslintBin}"` : 'npx --no-install eslint';

let failedAsRequired = false;
let output = '';
try {
  execSync(`${eslintCmd} src/modules/identity/domain/_boundary_probe.ts`, {
    cwd: join(repoRoot, 'apps/api'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
} catch (err) {
  output = `${err.stdout || ''}${err.stderr || ''}`;
  failedAsRequired = /boundaries/.test(output);
}

try {
  unlinkSync(probe);
} catch {
  /* ignore */
}

if (!failedAsRequired) {
  console.error('Expected ESLint to fail the domain → infrastructure probe.');
  if (output) console.error(output);
  process.exit(1);
}

console.log('assert-boundaries: probe import was rejected');
