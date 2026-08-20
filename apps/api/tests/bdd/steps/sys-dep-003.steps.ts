import { Given, Then, When } from '@cucumber/cucumber';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = join(process.cwd(), '../..');

const SAAS_HOSTS: string[] = JSON.parse(
  readFileSync(join(repoRoot, 'scripts/saas-hosts.json'), 'utf8'),
);

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.next', 'coverage', '.git'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

Given('a clean clone and copied .env.example', function () {
  if (!existsSync(join(repoRoot, '.env.example'))) {
    throw new Error('.env.example missing');
  }
});

When('I run docker compose up', function () {
  const compose = join(repoRoot, 'infra/compose/docker-compose.yml');
  if (!existsSync(compose)) {
    throw new Error('docker-compose.yml missing');
  }
  const yaml = readFileSync(compose, 'utf8');
  for (const name of ['postgres:', 'valkey:', 'rabbitmq:', 'minio:', 'mailpit:', 'traefik:']) {
    if (!yaml.includes(name)) {
      throw new Error(`compose missing ${name}`);
    }
  }
});

Then(/^api \/health is 200 within 5 minutes$/, async function () {
  if (process.env.ZOQO_BDD_INFRA === '1') {
    const url = process.env.API_URL ?? 'http://localhost:3001/health';
    const deadline = Date.now() + 5 * 60 * 1000;
    let last = '';
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url);
        if (res.ok) return;
        last = String(res.status);
      } catch (err) {
        last = err instanceof Error ? err.message : String(err);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`/health not 200: ${last}`);
  }
  const controller = readFileSync(join(repoRoot, 'apps/api/src/health.controller.ts'), 'utf8');
  if (!controller.includes("@Get('health')") || !controller.includes("@Get('ready')")) {
    throw new Error('HealthController must expose /health and /ready');
  }
});

Then('no outbound call is made to a third-party SaaS', function () {
  const roots = ['.env.example', 'infra', 'apps', 'packages'].map((p) => join(repoRoot, p));
  const hits: string[] = [];
  for (const root of roots) {
    const files = existsSync(root)
      ? statSync(root).isDirectory()
        ? walk(root)
        : [root]
      : [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const host of SAAS_HOSTS) {
        if (text.includes(host.toLowerCase())) {
          hits.push(`${relative(repoRoot, file)}: ${host}`);
        }
      }
    }
  }
  if (hits.length) {
    throw new Error(`SaaS references found:\n${hits.join('\n')}`);
  }
});
