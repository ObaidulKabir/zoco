#!/usr/bin/env node
/**
 * Builds docs/qa/rtm.csv from Gherkin tags (QA §4).
 * Columns: srs_id, priority, feature_file, scenario, layer, last_green, train
 *
 * `last_green` is stamped from the Cucumber JSON report when a scenario passed,
 * and otherwise carried over from the previous file so the CSV stays a living
 * record rather than a snapshot of the last run.
 *
 * Usage:
 *   node scripts/build-rtm.cjs           # regenerate
 *   node scripts/build-rtm.cjs --check   # also fail when a P0 row has no last_green
 */
const { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } = require('node:fs');
const { join, relative, sep } = require('node:path');

const repoRoot = join(__dirname, '..');
const featuresDir = join(repoRoot, 'features');
const outFile = join(repoRoot, 'docs/qa/rtm.csv');
const cucumberReport = join(repoRoot, 'apps/api/reports/cucumber.json');
const COLUMNS = ['srs_id', 'priority', 'feature_file', 'scenario', 'layer', 'last_green', 'train'];

const SRS_ID = /^@([A-Z]+-[A-Z]+-\d+)$/;
const PRIORITY = /^@(P[012])$/;
const JOURNEY = /^@journey-(\d+)$/;

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (full.endsWith('.feature')) acc.push(full);
  }
  return acc;
}

function tagsOf(line) {
  return line.trim().startsWith('@') ? line.trim().split(/\s+/) : [];
}

function parseFeature(file) {
  const rows = [];
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const featureFile = relative(repoRoot, file).split(sep).join('/');
  let featureTags = [];
  let pending = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const tags = tagsOf(trimmed);
    if (tags.length) {
      pending = pending.concat(tags);
      continue;
    }
    if (/^Feature:/.test(trimmed)) {
      featureTags = pending;
      pending = [];
      continue;
    }
    if (/^(Scenario|Scenario Outline):/.test(trimmed)) {
      const all = featureTags.concat(pending);
      pending = [];
      rows.push({
        srs_id: all.map((t) => t.match(SRS_ID)?.[1]).find(Boolean) ?? 'none',
        priority: all.map((t) => t.match(PRIORITY)?.[1]).find(Boolean) ?? 'P2',
        feature_file: featureFile,
        scenario: trimmed.replace(/^(Scenario Outline|Scenario):\s*/, ''),
        layer: all.some((t) => JOURNEY.test(t)) ? 'bdd+e2e' : 'bdd',
      });
    }
  }
  return rows;
}

function passedScenarios() {
  if (!existsSync(cucumberReport)) return new Set();
  try {
    const report = JSON.parse(readFileSync(cucumberReport, 'utf8'));
    const passed = new Set();
    for (const feature of report) {
      for (const element of feature.elements ?? []) {
        const green = (element.steps ?? []).every((step) => step.result?.status === 'passed');
        if (green) passed.add(element.name);
      }
    }
    return passed;
  } catch {
    return new Set();
  }
}

function splitCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted && char === '"' && line[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function parseCsv(text) {
  const [header, ...rest] = text.trim().split(/\r?\n/);
  if (!header) return [];
  const keys = splitCsvLine(header);
  return rest
    .filter(Boolean)
    .map((line) => Object.fromEntries(splitCsvLine(line).map((cell, i) => [keys[i], cell])));
}

function previousGreens() {
  if (!existsSync(outFile)) return new Map();
  const map = new Map();
  for (const row of parseCsv(readFileSync(outFile, 'utf8'))) {
    if (row.last_green) map.set(`${row.feature_file}::${row.scenario}`, row.last_green);
  }
  return map;
}

const quote = (value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const today = new Date().toISOString().slice(0, 10);
const train = process.env.RELEASE_TRAIN ?? '';
const passed = passedScenarios();
const carried = previousGreens();

const rows = walk(featuresDir)
  .flatMap(parseFeature)
  .map((row) => ({
    ...row,
    last_green: passed.has(row.scenario) ? today : carried.get(`${row.feature_file}::${row.scenario}`) ?? '',
    train,
  }));

mkdirSync(join(repoRoot, 'docs/qa'), { recursive: true });
writeFileSync(outFile, [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => quote(r[c])).join(','))].join('\n') + '\n');
console.log(`rtm: ${rows.length} scenarios -> ${relative(repoRoot, outFile)} (${passed.size} green this run)`);

if (process.argv.includes('--check')) {
  const red = rows.filter((r) => r.priority === 'P0' && !r.last_green);
  if (red.length) {
    console.error('P0 scenarios with no recorded green run:');
    for (const r of red) console.error(`  ${r.srs_id} · ${r.scenario} (${r.feature_file})`);
    process.exit(1);
  }
}
