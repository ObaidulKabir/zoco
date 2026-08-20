#!/usr/bin/env node
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { loadRootEnv, repoRoot } = require('./load-root-env.cjs');

const profile = process.argv[2] || 'minimal';
const extra = process.argv.slice(3);
const envFile = existsSync(join(repoRoot, '.env'))
  ? join(repoRoot, '.env')
  : join(repoRoot, '.env.example');

loadRootEnv();

const check = spawn(process.execPath, [join(__dirname, 'check-ports.cjs'), '--compose-only', '--profile', profile], {
  stdio: 'inherit',
  cwd: repoRoot,
});

check.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const child = spawn(
    'docker',
    [
      'compose',
      '--env-file',
      envFile,
      '-f',
      join(repoRoot, 'infra/compose/docker-compose.yml'),
      '--profile',
      profile,
      'up',
      ...extra,
    ],
    { stdio: 'inherit', cwd: repoRoot, shell: process.platform === 'win32' },
  );
  child.on('exit', (c) => process.exit(c ?? 1));
});
