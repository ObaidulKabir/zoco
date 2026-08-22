# Sprint 4 QA Closure Checklist

Scope: `MSG-CH-001`–`004` from `ZOQO-SPRINTS-001.md` Sprint 4 section.

Sprint 4 goal: public/private channels, threads, and mentions with tenant-safe behavior.

## 1) Required automated evidence

- [x] Channel behavior BDD pack green (`MSG-CH-001`, `MSG-CH-002`)
  - Command: `npx cucumber-js --config cucumber.cjs --tags "@MSG-CH-001 or @MSG-CH-002"`
  - Result: pass (local, 2026-08-23)
  - Primary evidence files:
    - `features/channels/MSG-CH-001-channels.feature`
    - `features/channels/MSG-CH-002-shared-channels.feature`

- [x] Threads + mentions BDD pack green (`MSG-TH-001`, `MSG-MEN-001`)
  - Command: `npx cucumber-js --config cucumber.cjs --tags "@MSG-TH-001 or @MSG-MEN-001"`
  - Result: pass (local, 2026-08-23)
  - Primary evidence files:
    - `features/channels/MSG-TH-001-threads.feature`
    - `features/channels/MSG-MEN-001-mentions.feature`

- [ ] Journey-level UI evidence for channels flow
  - Expected: Playwright journey covering create/browse/join/thread/mention in web shell
  - Current: no dedicated channel journey spec in `apps/web/e2e`

- [ ] CI evidence bundle for Sprint 4 tags
  - Expected: CI run or artifact showing Sprint 4 scenario set green
  - Current: Sprint 4 tag-focused run executed locally; latest CI run is green overall but not isolated to Sprint 4 scope

## 2) Exit criteria mapping (Sprint plan)

- [x] `@channel` fans out notify stubs to members  
      Verified by `MSG-MEN-001` scenario: "@channel mentions all channel members".

- [ ] Unread counts in sidebar  
      No dedicated web/e2e assertion for sidebar unread counters in Sprint 4 scope yet.

- [ ] Tenant isolation: cannot join another org's channel by ID  
      No explicit Sprint 4 scenario/assertion found for cross-org channel join rejection.

## 3) Open gaps to close before PASS

- Add a Sprint 4 Playwright journey (or extend an existing journey) for channel browser + thread + mention behavior in web UI.
- Add an automated cross-tenant join-by-id/slug negative test and assert forbidden behavior.
- Add/extend assertion for sidebar unread count updates in web shell.
- Run `pnpm test:bdd` end-to-end once local hang behavior is understood, or capture CI evidence with Sprint 4-focused report output.

## 4) Sign-off record

- [x] Date/time: 2026-08-23 00:20 (UTC+6)
- [x] Engineer: HP + Cursor assistant
- [x] Commands run:
  - `npx cucumber-js --config cucumber.cjs --tags "@MSG-CH-001 or @MSG-CH-002"`
  - `npx cucumber-js --config cucumber.cjs --tags "@MSG-TH-001 or @MSG-MEN-001"`
- [x] Evidence links (local + repository artifacts):
  - Sprint plan source: `ZOQO-SPRINTS-001.md` (Sprint 4 section)
  - Feature files listed in sections 1 and 2 above
- [x] Decision: FAIL (in progress; open exit-criteria gaps)
