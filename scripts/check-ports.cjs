#!/usr/bin/env node
/**
 * Fail if Zoqo host ports are already bound (local Postgres, Apache, etc.).
 */
const { loadRootEnv, repoRoot } = require('./load-root-env.cjs');
const { occupant, isPortFree, portsForProfiles, resolvePort, suggestPort } = require('./ports.cjs');

function parseArgs(argv) {
  const profiles = [];
  let includeApps = true;
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--compose-only') includeApps = false;
    else if (a === '--apps-only') {
      profiles.length = 0;
      profiles.push('apps');
      includeApps = false;
    } else if (a === '--profile' && argv[i + 1]) {
      profiles.push(argv[++i]);
    } else if (!a.startsWith('-')) {
      profiles.push(a);
    }
  }
  if (!profiles.length) {
    const fromEnv = String(process.env.COMPOSE_PROFILES || 'minimal')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    profiles.push(...fromEnv);
  }
  if (includeApps) profiles.push('apps');
  return [...new Set(profiles)];
}

async function main() {
  const env = loadRootEnv();
  const profiles = parseArgs(process.argv);
  const rows = portsForProfiles(profiles);
  const conflicts = [];

  for (const row of rows) {
    const port = resolvePort(env, row.key, row.default);
    const free = await isPortFree(port);
    if (free) continue;
    const who = occupant(port);
    const suggested = await suggestPort(port);
    conflicts.push({ ...row, port, who, suggested });
  }

  const pgPort = resolvePort(env, 'POSTGRES_PORT', 5432);
  const dbUrl = String(env.DATABASE_URL || '');
  const dbMatch = dbUrl.match(/@[^/]+:(\d+)/);
  if (profiles.some((p) => ['default', 'minimal', 'test'].includes(p)) && dbMatch && Number(dbMatch[1]) !== pgPort) {
    console.error(
      `DATABASE_URL uses port ${dbMatch[1]} but POSTGRES_PORT=${pgPort}. Update DATABASE_URL to match.`,
    );
    process.exit(1);
  }

  if (!conflicts.length) {
    console.log(`check-ports: ${rows.length} port(s) free for profiles [${profiles.join(', ')}]`);
    return;
  }

  console.error('These Zoqo ports are already in use by other applications:\n');
  for (const c of conflicts) {
    const proc = c.who ? `${c.who.name} (PID ${c.who.pid})` : 'unknown process';
    const hint = c.suggested ? `  → set ${c.key}=${c.suggested} in .env` : `  → set ${c.key} in .env to a free port`;
    console.error(`  ${c.port}  ${c.service}  held by ${proc}`);
    console.error(hint);
  }
  console.error(`\nCopy .env.example to .env if you have not, then change the variables above.`);
  console.error(`Repo: ${repoRoot}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
