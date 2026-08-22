# Sprint 3 QA Closure Checklist

Scope: `MSG-DM-001`–`005`, `SHIELD-CORE-001` from `ZOQO-SPRINTS-001.md` Sprint 3 section.

This checklist is the concrete go/no-go gate before declaring Sprint 3 QA complete.

## 1) Required automated evidence

- [x] BDD messenger pack green (`MSG-DM-*`, `SHIELD-CORE-001`)
  - Command: `pnpm test:bdd`
  - Evidence: CI `verify` job success in run `32588358264`  
    <https://github.com/ObaidulKabir/zoco/actions/runs/32588358264/job/97068065305>
  - Primary evidence files:
    - `features/messenger/MSG-DM-001-direct-message.feature`
    - `features/messenger/MSG-DM-002-message-actions.feature`
    - `features/messenger/MSG-DM-003-typing-indicators.feature`
    - `features/messenger/MSG-DM-004-read-receipts.feature`
    - `features/messenger/MSG-DM-005-presence.feature`
    - `features/messenger/SHIELD-CORE-001-e2ee-envelope.feature`

- [x] Journey 2 (DM part) Playwright green
  - Command: `pnpm test:journey2`
  - Test file: `apps/web/e2e/journey-2.spec.ts`
  - Evidence: CI `e2e` job success in run `32588358264`  
    <https://github.com/ObaidulKabir/zoco/actions/runs/32588358264/job/97070512461>

- [ ] Local WS load smoke: 100 concurrent connections
  - Command: `pnpm test:ws:smoke`
  - Script: `scripts/ws-load-smoke.mjs`
  - Latest local attempt (2026-08-23): `opened=0/100, failed=100` (failed)
  - Defaults:
    - `WS_SMOKE_CLIENTS=100`
    - `WS_SMOKE_OPEN_TIMEOUT_MS=12000`
    - `WS_SMOKE_HOLD_MS=3000`
    - `WS_SMOKE_URL=ws://localhost:3001/socket.io/?EIO=4&transport=websocket`

- [ ] Combined run (recommended one-liner)
  - Command: `pnpm qa:sprint3`

## 2) Exit criteria mapping (Sprint plan)

- [x] Offline reconnect delivers missed messages  
      Verified by `MSG-DM-001` offline reconnect scenario.

- [x] Journey 2 (DM part) green  
      Verified by `apps/web/e2e/journey-2.spec.ts`.

- [ ] Load smoke: 100 concurrent WS connections locally  
      Verified by `scripts/ws-load-smoke.mjs` pass output.

- [x] DM row contains no plaintext (QA Pack C)  
      Verified by `SHIELD-CORE-001` envelope/ciphertext scenarios.

## 3) Operator notes

- Use `E2E_BASE_URL` and `MAILPIT_URL` when targeting deployed staging.
- For local runs, ensure API/web servers are started by Playwright config or already running.
- If WS smoke fails, capture:
  - endpoint used (`WS_SMOKE_URL`)
  - opened/failed counts
  - sample failure lines from script output

## 4) Sign-off record

- [x] Date/time: 2026-08-23 00:10 (UTC+6)
- [x] Engineer: HP + Cursor assistant
- [x] Commands run:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test:ws:smoke` (local; failed)
  - CI run reference for commit `d522c1a`
- [x] Evidence links (CI run IDs / local logs):
  - CI run (all jobs green): <https://github.com/ObaidulKabir/zoco/actions/runs/32588358264>
  - Verify job (includes `pnpm test:bdd`): <https://github.com/ObaidulKabir/zoco/actions/runs/32588358264/job/97068065305>
  - E2E job (includes Journey 2): <https://github.com/ObaidulKabir/zoco/actions/runs/32588358264/job/97070512461>
  - Images job: <https://github.com/ObaidulKabir/zoco/actions/runs/32588358264/job/97070512437>
  - Security job: <https://github.com/ObaidulKabir/zoco/actions/runs/32588358264/job/97068065188>
- [x] Decision: FAIL (pending required local WS smoke pass at 100 concurrent clients)

