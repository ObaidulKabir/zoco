#!/usr/bin/env node
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { loadRootEnv, repoRoot } = require('./load-root-env.cjs');
const { isPortFree, occupant, suggestPort } = require('./ports.cjs');

async function main() {
  const env = loadRootEnv();
  const port = Number(env.WEB_PORT ?? 3000);
  if (!(await isPortFree(port))) {
    const who = occupant(port);
    const suggested = await suggestPort(port);
    const proc = who ? `${who.name} (PID ${who.pid})` : 'another process';
    console.error(`WEB_PORT ${port} is in use by ${proc}.`);
    if (suggested) console.error(`Set WEB_PORT=${suggested} in .env and retry.`);
    process.exit(1);
  }

  const bins = [
    join(repoRoot, 'apps/web/node_modules/next/dist/bin/next'),
    join(repoRoot, 'node_modules/next/dist/bin/next'),
  ];
  const nextBin = bins.find((p) => existsSync(p));
  if (!nextBin) {
    console.error('next binary not found. Run pnpm install.');
    process.exit(1);
  }

  const child = spawn(process.execPath, [nextBin, 'dev', '-p', String(port)], {
    stdio: 'inherit',
    cwd: join(repoRoot, 'apps/web'),
    env: { ...process.env, PORT: String(port), WEB_PORT: String(port) },
  });
  child.on('exit', (code) => process.exit(code ?? 1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
