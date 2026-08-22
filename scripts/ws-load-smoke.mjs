#!/usr/bin/env node
/**
 * Sprint 3 exit evidence: local smoke for 100 concurrent WebSocket clients.
 *
 * Usage:
 *   WS_SMOKE_URL=ws://localhost:3001/socket.io/?EIO=4&transport=websocket pnpm test:ws:smoke
 *
 * Notes:
 * - This script validates the gateway can accept and keep 100 concurrent socket
 *   handshakes alive long enough to count as a smoke pass.
 * - It intentionally does not model chat traffic; this is a capacity sanity
 *   check, not a latency benchmark.
 */

const url = process.env.WS_SMOKE_URL || 'ws://localhost:3001/socket.io/?EIO=4&transport=websocket';
const target = Number(process.env.WS_SMOKE_CLIENTS || '100');
const openTimeoutMs = Number(process.env.WS_SMOKE_OPEN_TIMEOUT_MS || '12000');
const holdMs = Number(process.env.WS_SMOKE_HOLD_MS || '3000');

if (!Number.isFinite(target) || target <= 0) {
  console.error(`Invalid WS_SMOKE_CLIENTS value: ${process.env.WS_SMOKE_CLIENTS}`);
  process.exit(2);
}

const sockets = [];
let opened = 0;
let failed = 0;
const errors = [];

const openOne = (index) =>
  new Promise((resolve) => {
    const ws = new WebSocket(url);
    sockets.push(ws);
    let settled = false;

    const settle = (onFailMessage) => {
      if (settled) return;
      settled = true;
      if (onFailMessage) {
        failed += 1;
        errors.push(onFailMessage);
      }
      resolve();
    };

    const timer = setTimeout(() => {
      settle(`#${index}: open timeout after ${openTimeoutMs}ms`);
      try {
        ws.close();
      } catch {
        // ignore
      }
    }, openTimeoutMs);

    ws.addEventListener('open', () => {
      clearTimeout(timer);
      opened += 1;
      settle();
    });

    ws.addEventListener('error', (event) => {
      clearTimeout(timer);
      settle(`#${index}: websocket error (${event?.type ?? 'unknown'})`);
    });
  });

const start = Date.now();
await Promise.all(Array.from({ length: target }, (_, i) => openOne(i + 1)));
const elapsedOpen = Date.now() - start;

// Keep sockets connected briefly; abrupt disconnects often show up here.
await new Promise((r) => setTimeout(r, holdMs));

for (const ws of sockets) {
  try {
    ws.close();
  } catch {
    // ignore
  }
}

const success = opened === target && failed === 0;
console.log(`ws-smoke: opened=${opened}/${target}, failed=${failed}, open_elapsed_ms=${elapsedOpen}, hold_ms=${holdMs}`);

if (!success) {
  if (errors.length) {
    console.error('ws-smoke: sample failures:');
    for (const line of errors.slice(0, 10)) console.error(`  ${line}`);
  }
  process.exit(1);
}

