const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const repoRoot = join(__dirname, '..');

function parseEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadRootEnv() {
  const fromFiles = {
    ...parseEnvFile(join(repoRoot, '.env.example')),
    ...parseEnvFile(join(repoRoot, '.env')),
  };
  const merged = { ...fromFiles, ...process.env };
  for (const [k, v] of Object.entries(fromFiles)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return merged;
}

module.exports = { repoRoot, parseEnvFile, loadRootEnv };
