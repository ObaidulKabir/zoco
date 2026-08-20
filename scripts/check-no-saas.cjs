#!/usr/bin/env node
/**
 * Fails if .env.example, compose, or application code references paid SaaS hosts (SYS-DEP-003).
 */
const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

const repoRoot = join(__dirname, '..');
const hosts = JSON.parse(readFileSync(join(repoRoot, 'scripts/saas-hosts.json'), 'utf8'));

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.next', 'coverage', '.git'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const roots = ['.env.example', 'infra', 'apps', 'packages'].map((p) => join(repoRoot, p));
const hits = [];
for (const root of roots) {
  if (!existsSync(root)) continue;
  const files = statSync(root).isDirectory() ? walk(root) : [root];
  for (const file of files) {
    const text = readFileSync(file, 'utf8').toLowerCase();
    for (const host of hosts) {
      if (text.includes(host.toLowerCase())) {
        hits.push(`${relative(repoRoot, file)}: ${host}`);
      }
    }
  }
}

if (hits.length) {
  console.error('Forbidden SaaS hosts:\n' + hits.join('\n'));
  process.exit(1);
}

console.log('check-no-saas: no forbidden SaaS hosts in env/compose/apps/packages');
