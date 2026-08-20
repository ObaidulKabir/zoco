#!/usr/bin/env node
/**
 * Fails on GPL/AGPL/SSPL/BUSL and other licenses not listed in ALLOWED_LICENSES.
 */
const { execSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const repoRoot = join(__dirname, '..');
const allowed = new Set(
  readFileSync(join(repoRoot, 'ALLOWED_LICENSES'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean),
);

const banned = /gpl|agpl|sspl|busl|commons clause|elastic-2/i;

function normalize(raw) {
  return String(raw || 'UNKNOWN')
    .replace(/[()]/g, ' ')
    .split(/\s+(?:OR|AND)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

const pnpmBin =
  process.platform === 'win32'
    ? join(repoRoot, 'node_modules/.bin/pnpm.cmd')
    : join(repoRoot, 'node_modules/.bin/pnpm');
const pnpmCmd = existsSync(pnpmBin) ? `"${pnpmBin}"` : 'npx --yes pnpm@9.12.0';

let json;
try {
  const out = execSync(`${pnpmCmd} licenses list --json`, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  const start = out.indexOf('{');
  json = JSON.parse(start >= 0 ? out.slice(start) : out);
} catch (err) {
  console.error('Could not run `pnpm licenses list --json`. Did you run pnpm install?');
  console.error(err.stderr || err.message);
  process.exit(1);
}

const violations = [];
const entries = json && typeof json === 'object' ? Object.entries(json) : [];
for (const [license, packages] of entries) {
  const list = Array.isArray(packages) ? packages : [];
  const thirdParty = list.filter((p) => {
    const name = typeof p === 'string' ? p : p.name;
    return name && !String(name).startsWith('@zoqo/');
  });
  if (!thirdParty.length) continue;
  const parts = normalize(license);
  const ok = parts.some((p) => allowed.has(p)) && !banned.test(license);
  if (!ok) {
    const names = thirdParty.map((p) => (typeof p === 'string' ? p : p.name)).slice(0, 8);
    violations.push(`${license}: ${names.join(', ')}`);
  }
}

if (violations.length) {
  console.error('Disallowed licenses:\n' + violations.join('\n'));
  process.exit(1);
}

console.log('check-licenses: all discovered licenses are on the allow-list');
