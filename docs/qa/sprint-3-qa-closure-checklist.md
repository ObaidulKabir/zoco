# Sprint 3 QA Closure Checklist

Scope: `MSG-DM-001`–`005`, `SHIELD-CORE-001` from `ZOQO-SPRINTS-001.md` Sprint 3 section.

This checklist is the concrete go/no-go gate before declaring Sprint 3 QA complete.

## 1) Required automated evidence

- [ ] BDD messenger pack green (`MSG-DM-*`, `SHIELD-CORE-001`)
  - Command: `pnpm test:bdd`
  - Primary evidence files:
    - `features/messenger/MSG-DM-001-direct-message.feature`
    - `features/messenger/MSG-DM-002-message-actions.feature`
    - `features/messenger/MSG-DM-003-typing-indicators.feature`
    - `features/messenger/MSG-DM-004-read-receipts.feature`
    - `features/messenger/MSG-DM-005-presence.feature`
    - `features/messenger/SHIELD-CORE-001-e2ee-envelope.feature`

- [ ] Journey 2 (DM part) Playwright green
  - Command: `pnpm test:journey2`
  - Test file: `apps/web/e2e/journey-2.spec.ts`

- [ ] Local WS load smoke: 100 concurrent connections
  - Command: `pnpm test:ws:smoke`
  - Script: `scripts/ws-load-smoke.mjs`
  - Defaults:
    - `WS_SMOKE_CLIENTS=100`
    - `WS_SMOKE_OPEN_TIMEOUT_MS=12000`
    - `WS_SMOKE_HOLD_MS=3000`
    - `WS_SMOKE_URL=ws://localhost:3001/socket.io/?EIO=4&transport=websocket`

- [ ] Combined run (recommended one-liner)
  - Command: `pnpm qa:sprint3`

## 2) Exit criteria mapping (Sprint plan)

- [ ] Offline reconnect delivers missed messages  
      Verified by `MSG-DM-001` offline reconnect scenario.

- [ ] Journey 2 (DM part) green  
      Verified by `apps/web/e2e/journey-2.spec.ts`.

- [ ] Load smoke: 100 concurrent WS connections locally  
      Verified by `scripts/ws-load-smoke.mjs` pass output.

- [ ] DM row contains no plaintext (QA Pack C)  
      Verified by `SHIELD-CORE-001` envelope/ciphertext scenarios.

## 3) Operator notes

- Use `E2E_BASE_URL` and `MAILPIT_URL` when targeting deployed staging.
- For local runs, ensure API/web servers are started by Playwright config or already running.
- If WS smoke fails, capture:
  - endpoint used (`WS_SMOKE_URL`)
  - opened/failed counts
  - sample failure lines from script output

## 4) Sign-off record

- [ ] Date/time:
- [ ] Engineer:
- [ ] Commands run:
- [ ] Evidence links (CI run IDs / local logs):
- [ ] Decision: PASS / FAIL

