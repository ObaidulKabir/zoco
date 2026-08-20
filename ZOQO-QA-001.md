# Zoqo — QA & Test Strategy to Pass Quality Gates
## Document ID: ZOQO-QA-001 · Version 1.1 · August 2026

| Field | Detail |
|---|---|
| **Companion to** | [ZOQO-SDP-001](./ZOQO-SDP-001.md) · [ZOQO-SRS-001](./ZOQO-SRS-001.md) v1.6 · [ZOQO-SPRINTS-001](./ZOQO-SPRINTS-001.md) |
| **Purpose** | Make “pass QA” a **measurable, repeatable evidence pack**, not a feeling after a demo |
| **Who does QA** | Phase 1 has no separate QA department. Engineers own automation. One engineer rotates as **Release QA** for each train. |
| **Tools** | All free / self-hosted: Jest, Cucumber.js, Playwright, Supertest, k6, axe-core, Lighthouse CI, Trivy, Mailpit, GlitchTip |

The SDP says **how we run**. The SRS says **what** must be true. The sprint playbook says **when**. This document says **how we prove it** and **what “QA passed” means**.

---

## 1. What “pass QA” means

A build **passes QA** only when all four are true:

| # | Gate | Evidence |
|---|---|---|
| 1 | **Specified** | Every in-scope SRS ID has Gherkin tagged with that ID |
| 2 | **Automated green** | The test pack for that train is green on **staging**, not only on a laptop |
| 3 | **Risks closed** | No open **Blocker** or **Critical** defects; High defects have a written waiver |
| 4 | **Signed** | Release QA checklist in §12 completed and named in the release note |

If any row fails, the train does **not** ship. Fix or cut scope. Do not “QA later.”

**Pass is train-specific.** Dogfood (after Sprint 6) does not need Meet or Flow. Private beta (Sprint 12) needs every P0 journey.

---

## 2. Quality principles

| ID | Rule |
|---|---|
| `QA-001` | **No behaviour without a test that can fail.** If you cannot write a failing scenario, the requirement is not ready. |
| `QA-002` | **Traceability is bidirectional.** SRS ID → feature file → CI job → defect. A test with no SRS ID is deleted or tagged `@tech`. |
| `QA-003` | **Test through the port at unit level; test the adapter at integration level.** Never call LibreTranslate, LiveKit, or SMTP from a unit test. |
| `QA-004` | **Tenant isolation is a test, not a comment.** Every write-path suite includes a second-tenant 404/empty assertion. |
| `QA-005` | **Fail open is tested, not assumed.** Kill Translate / Mail / Search in a dedicated scenario; core chat must still 201. |
| `QA-006` | **Flakes are defects.** A test that fails once in five runs is quarantined (`@flake`) and counts as a High defect until fixed or deleted. |
| `QA-007` | **Exploratory testing is scheduled**, not leftover time. 90 minutes per sprint per module touched. |
| `QA-008` | **Production is not the test environment.** Prod smoke is 11 journeys, read-mostly, after deploy. |

---

## 3. Test pyramid (what runs where)

```
            ┌─────────────┐
            │ Prod smoke  │  11 journeys, post-deploy, 10 min
            └──────▲──────┘
            ┌──────┴──────┐
            │  E2E UI     │  Playwright, P0 journeys, staging
            │  (~2%)      │
            └──────▲──────┘
            ┌──────┴──────┐
            │ BDD / API   │  Cucumber + HTTP/WS, staging + CI
            │  (~8%)      │
            └──────▲──────┘
            ┌──────┴──────┐
            │ Integration │  real Postgres, Valkey, Rabbit, MinIO
            │  (~20%)     │
            └──────▲──────┘
            ┌──────┴──────┐
            │ Unit TDD    │  domain + application, in-memory fakes
            │  (~70%)     │
            └─────────────┘
```

| Layer | Command | Environment | When |
|---|---|---|---|
| Unit | `pnpm test:unit` | Laptop / CI | Every PR |
| Integration | `pnpm test:int` | Compose `profile: test` | Every PR |
| BDD API | `pnpm test:bdd` | CI + nightly staging | Every PR (module tags); full pack on `main` |
| E2E UI | `pnpm test:e2e` | Staging | Smoke on PR (`@smoke`); full `@P0` on `main` |
| Perf | `pnpm test:perf` | Staging | Nightly from S12; gate on beta |
| Security | `pnpm test:sec` | CI + staging | Every PR (Trivy, tenant suite); full pack S12 |
| A11y | `pnpm test:a11y` | CI | Every PR on changed pages |
| Exploratory | Session charter | Staging | Sprint day 8–9 |
| Translation quality | Fixture + human | Staging | S6 automated; S12 native-speaker sign-off |

**Coverage gates (unchanged from SRS `SYS-DEV-013`):**

| Scope | Minimum to merge |
|---|---|
| Changed module `domain/` + `application/` | 90% lines |
| Repository | 80% lines |
| P0 acceptance criteria in the sprint | 100% have a green tagged scenario |
| Port fakes | One in-memory fake per port |

---

## 4. Traceability model

```
ZOQO-SRS-001 requirement ID
    └── features/<context>/<id>.feature   @ORG-AUTH-002 @P0 @smoke
            └── step definitions
                    └── unit tests (same ID in describe())
                    └── integration tests
                    └── Playwright (only if UI journey)
                            └── CI job artifact
                                    └── RTM row in this file §8
```

**Tag vocabulary (mandatory):**

| Tag | Meaning |
|---|---|
| `@ORG-AUTH-002` | SRS requirement (one primary ID per scenario) |
| `@P0` `@P1` `@P2` | Priority; `@P0` is a beta blocker if red |
| `@smoke` | In the 15-minute PR pack |
| `@journey-N` | Maps to SRS §6.2 journey 1–11 |
| `@tenant` | Isolation assertion |
| `@degrade` | Sidecar down |
| `@security` | Authz, injection, headers |
| `@a11y` | Accessibility |
| `@flake` | Quarantine — not a pass |

Gherkin files live in `/features`. Naming: `features/identity/ORG-AUTH-002-login.feature`.

**RTM living file:** `docs/qa/rtm.csv` (generated in CI from tags). Columns: `srs_id, priority, feature_file, scenario, layer, last_green, train`. A P0 row with empty `last_green` **fails CI** from Sprint 3 onward.

---

## 5. Environments

| Env | Used for | Data | Reset |
|---|---|---|---|
| **Local** | TDD, unit, Compose | `.env.example`, Mailpit | Developer’s machine |
| **CI** | PR gates | Ephemeral Compose; seeded | Every job |
| **Staging** | Full BDD, E2E, perf, exploratory, Release QA | Known seed (§6); refresh nightly | Nightly + on demand |
| **Production** | 11-journey smoke after deploy | Real tenants — **no destructive tests** | N/A |

Staging must mirror production Compose (same images, reduced translation pack). If a test only passes locally, it has **not** passed QA.

---

## 6. Test data and personas

Seed (`pnpm seed:qa`) creates **fixed UUIDs and passwords** for automation. Never use production-like personal data.

| Persona | Email (staging) | Org | Role | Language |
|---|---|---|---|---|
| **Owner A** | `sarah@acme.test` | Acme | Owner | `en` |
| **Admin A** | `admin@acme.test` | Acme | Admin | `en` |
| **Manager A** | `lee@acme.test` | Acme | Manager | `en` |
| **Member A** | `pat@acme.test` | Acme | Member | `en` |
| **Owner B** | `rahim@nodi.test` | Nodi Traders | Owner | `bn` |
| **Member B** | `fatima@nodi.test` | Nodi Traders | Member | `hi` |
| **Unverified** | `new@wait.test` | — | — | `en` |
| **Locked** | `lock@acme.test` | Acme | Member | `en` |
| **Guest** | (magic link) | Acme channel | Guest | `en` |

**Orgs:** Acme (connected to Nodi), Nodi Traders (connected to Acme), Orphan Co (no B2B) for isolation tests.

**Golden files:** `tests/fixtures/eicar.com` (malware), `tests/fixtures/ok.pdf`, `tests/fixtures/xlang/bn-en.json` (50 pairs).

Passwords: `Zoqo-QA-1!` everywhere on staging. Documented in the seed README, rotated only if staging is exposed.

---

## 7. What to test (by type)

### 7.1 Functional — BDD (primary QA weapon)

For **each** SRS acceptance-criterion bullet:

1. Happy path
2. One negative path (validation, 401, 403, 409)
3. Tenant isolation (`@tenant`)
4. If the feature uses a sidecar: `@degrade`

Example mapping for login:

| AC | Scenario |
|---|---|
| Login with email + password | `@ORG-AUTH-002` happy |
| Invalid credentials generic error | no email enumeration |
| Lockout after 5 fails | `lock@acme.test` |
| Login events audited | query audit table |
| Refresh rotation | reuse of old refresh → 401 |

### 7.2 Contract

Supertest against the Nest app:

- Envelope `{ success, data, error }` (§18.2)
- Status codes (§18.3)
- Pagination cursor
- WebSocket event shapes (§18.5) via a test client

A breaking envelope change fails the contract pack even if UI still “works.”

### 7.3 Integration

Real Postgres (RLS on), Valkey, RabbitMQ, MinIO, ClamAV. LibreTranslate **optional** — use the fake in PR CI; real engine on nightly staging.

Must include:

- RLS: set `app.tenant_id` to Acme, query Nodi’s rows → zero
- Rabbit: publish `message.created`, Notify consumer writes a row
- MinIO: upload, signed GET expires
- ClamAV: EICAR → `scan_status=infected`, file not readable

### 7.4 E2E UI (Playwright)

Only **journeys**, not every button. Two browsers: Chromium + Firefox. WebKit on nightly (Safari-ish). Viewport: 1280 and 390 (PWA phone).

Storage state: logged-in `sarah` and `rahim` saved once per run.

**WebRTC:** Playwright + fake media devices. Staging LiveKit. If the CI runner cannot use UDP, mark `@media` and run on the staging host runner only — still a gate for beta, not skipped forever.

### 7.5 Non-functional

| Area | Tool | Pass bar |
|---|---|---|
| API p95 | k6 + Grafana | `<200 ms` at 1,000 VU (beta) |
| WS delivery | k6-ws or custom | `<200 ms` median on staging |
| Lighthouse | LHCI | Perf ≥80, a11y ≥90 on app shell |
| A11y | axe-core in Playwright | No critical/serious on `@a11y` pages |
| Security | Trivy, `npm audit`, tenant fuzzer | No High CVE in images; zero cross-tenant reads |
| Encryption | Contract: ciphertext in DB for DMs | SELECT on `messages.content` for a DM is not plaintext |
| Backup | Timed restore drill | RTO ≤4 h, RPO ≤1 h |
| Email | Mailpit locally; staging real SMTP | OTP arrives; spoof headers present |
| Translation | Fixture BLEU-not-required; **intelligible** human review | `SYS-XLANG-002` signed |

### 7.6 Exploratory (session-based)

Charter template (90 min):

```
Charter: Try to read Acme channel data as Fatima (Nodi)
Setup: both orgs, existing B2B DM
Bugs: …
Questions: …
Coverage: URLs, roles, languages
```

Log sessions in `docs/qa/sessions/YYYY-MM-DD-<charter>.md`. Exploratory bugs go in the tracker with severity (§10). **Three sessions per sprint** minimum from Sprint 3.

Suggested charters by sprint: see §11.

---

## 8. Release test packs (the actual QA exams)

### Pack A — Smoke (≤15 min, every PR)

`@smoke` only. Must stay under 15 minutes.

- Health/ready
- Register + login
- Send one DM (API, not UI)
- Tenant 404 on a stolen UUID
- Licence + boundary lint

### Pack B — Journey pack (Playwright, `main` + Release QA)

Maps 1:1 to SRS §6.2. **All 11 green = functional QA pass for beta.**

| ID | Journey | Tags | First green by |
|---|---|---|---|
| J1 | Register org and invite team | `@journey-1 @P0` | S2 |
| J2 | DMs and channels | `@journey-2 @P0` | S4 |
| J3 | B2B connect and chat | `@journey-3 @P0` | S5 |
| J4 | Video call from chat | `@journey-4 @P0 @media` | S7 |
| J5 | Schedule meeting + RSVP | `@journey-5 @P0` | S8 |
| J6 | Publish business profile + search | `@journey-6 @P0` | S11 |
| J7 | Notifications (in-app + email + push*) | `@journey-7 @P0` | S10 |
| J8 | Submit leave request | `@journey-8 @P0` | S9 |
| J9 | Approve/reject workflow | `@journey-9 @P0` | S9 |
| J10 | Manage departments and roles | `@journey-10 @P0` | S2 |
| J11 | Cross-language B2B chat | `@journey-11 @P0 @xlang` | S6 |

\*Push: Web Push on Chromium with a stub service worker in E2E; real VAPID on staging manual check.

### Pack C — Isolation & abuse (security QA)

Run on every `main` and before beta:

- Stolen `conversationId` from another tenant → 404
- IDOR on workflow instance
- Invite to org B while authed as org A member
- XSS in message markdown
- Path traversal on file download
- Rate-limit 429 on `/v1/auth/login`
- CSRF: cookie-only request without bearer fails
- E2E DM: API response and DB row do not contain plaintext

### Pack D — Degradation

| Sidecar killed | Must still work | Must show |
|---|---|---|
| LibreTranslate | Send/receive messages | “Translation unavailable” |
| ClamAV | Upload rejected or queued, chat lives | Error on file, not on text |
| Mailpit/Postfix | Register still creates user | OTP in-app path / invite copy link |
| LiveKit | Chat lives | Call button error |
| RabbitMQ | HTTP send persists; realtime may lag | Metrics alert (ops), no 500 on send if outbox used |

If send requires Rabbit to commit, that is a **design fail** — use an outbox. QA will catch it.

### Pack E — Performance (beta gate)

k6 scripts in `tests/perf/`:

| Script | Load | Pass |
|---|---|---|
| `auth.js` | 100 login/s burst | no 5xx; lockout still works |
| `messages.js` | 1,000 VU sending 1 msg/s | p95 REST `<200ms`; WS `<200ms` |
| `search.js` | 50 search/s on 1M seeded messages | `<500ms` |
| `meet.js` | 50 concurrent 4-person rooms | connect `<5s` |

Seed 1M messages once on staging (job `seed:load`). Do not run this on every PR.

### Pack F — Accessibility & PWA

- axe on: login, inbox, conversation, meeting lobby, workflow form, profile
- Keyboard: compose, send, jump to thread
- Contrast on translated RTL bubble (`ar`)
- PWA: installability, offline draft survives reload

---

## 9. Defects — what blocks QA

| Severity | Definition | Ship? |
|---|---|---|
| **Blocker** | P0 journey unusable; data leak; data loss; cannot log in | **No** |
| **Critical** | P0 workaround only for experts; encryption broken; wrong-tenant glimpse | **No** |
| **High** | P1 broken; flake in `@P0`; a11y serious; translation garbage on bn↔en fixture | No unless waiver |
| **Medium** | P2; visual; copy | Yes, tracked |
| **Low** | Polish | Yes |

**Waiver:** written in the release note: defect ID, risk, expiry date, owner. Waivers older than 14 days become High again.

**Bug report must include:** SRS ID (or `none` + why), persona, env, expected vs actual, artifact (log `request_id`, screenshot, WS frame). Bugs without a path to reproduce are **not** Blockers.

---

## 10. How a sprint passes QA (Definition of Ready for the next sprint)

At sprint review, Release QA (rotating) checks:

- [ ] All sprint SRS IDs appear in `rtm.csv` with `last_green` today
- [ ] Pack A green on the sprint branch
- [ ] New `@P0` scenarios green on staging
- [ ] Zero new `@flake`
- [ ] At least 3 exploratory sessions filed
- [ ] No open Blocker/Critical on this sprint’s modules
- [ ] Coverage gates met on changed modules

If this list is red, the sprint is **not done**. The next sprint’s first days are fix-forward, not new P0.

---

## 11. QA work per Phase 1 sprint

Automation is written **in the same sprint as the feature** (SRS §21). This table is the extra QA focus.

| Sprint | Automate | Exploratory charter | Extra gate |
|---|---|---|---|
| **0** | `@SYS-DEP-003` stack start; lint/boundary | Break Compose; missing env | `minimal` profile on 8 GB |
| **1** | Auth BDD; lockout; enumeration | OTP reuse, two tabs, clock skew | Mailpit OTP only |
| **2** | J1, J10; invite expiry; dual-org switch | CSV invite junk, slug collision | Second-tenant member list empty |
| **3** | DM API + WS; receipts; presence | Two devices, lag, edit after 16 min | 100 WS smoke |
| **4** | J2; @mentions; threads | @channel storm, archive then post | Unread math |
| **5** | J3; accept/reject/block | Forge connection to Orphan Co | B2B cannot see #general of the other org |
| **6** | J11; file+EICAR; FTS; `@degrade` translate | Banglish, RTL, huge paste | Kill LibreTranslate |
| **7** | J4 `@media`; missed call | Symmetric NAT, mute, three browsers | coturn required |
| **8** | J5; .ics; RSVP | Recurrence edit, external guest | Guest without account |
| **9** | J8, J9; self-approve forbidden | Amount threshold boundary | Immutable actions (UPDATE fails) |
| **10** | J7; prefs; quiet hours | DND vs incoming call | Bounce metrics |
| **11** | J6; unpublished hidden; PWA | SEO fetch of draft profile | Lighthouse PWA |
| **12** | Packs C–F full; restore drill | Pen-test isolation | **Release QA §12** |

---

## 12. Release QA checklist (sign here to pass)

Print or copy into the GitHub Release. **All boxes required** for that train.

### 12.1 Every train

- [ ] Commit SHA and image tags recorded
- [ ] Pack A green on staging at this SHA
- [ ] Open Blockers: **0**. Open Criticals: **0**
- [ ] RTM: no P0 in this train with empty `last_green`
- [ ] GlitchTip: no new unresolved error spike vs last train
- [ ] Runbook: deploy + rollback tried on staging

### 12.2 Dogfood (after Sprint 6)

- [ ] J1, J2, J3, J10, J11 green on staging
- [ ] Translate degrade scenario green
- [ ] EICAR cannot be downloaded by recipient
- [ ] Two humans (bn + en) complete a 10-message B2B thread

### 12.3 Private beta (after Sprint 12) — **QA pass for “MVP complete”**

- [ ] **J1–J11 all green** on staging (Pack B)
- [ ] Pack C (isolation) green
- [ ] Pack D (degrade) green
- [ ] Pack E: 1,000 VU report attached; p95 REST <200 ms
- [ ] Pack F: axe no critical; PWA installable
- [ ] Restore drill minutes recorded (≤240)
- [ ] `SYS-XLANG-002` signed by a native speaker (bn, hi, ar)
- [ ] Staging stable 14 days **or** all defects from those 14 days closed
- [ ] TLS 1.3, HSTS, no admin UIs on public ports
- [ ] Prod smoke J1–J11 after first production deploy (read-only where needed)

### 12.4 GA (after Sprint 24)

- [ ] All beta boxes plus: OAuth journeys, Stripe test-mode checkout, Flutter smoke on a device farm or two physical phones
- [ ] k3s failover: kill one node, chat survives
- [ ] SOC 2 control tests mapped (even if not certified)

---

## 13. CI design (so QA cannot be skipped)

```
PR opened
  ├─ lint + licence + architecture boundaries
  ├─ test:unit (90% gate on changed modules)
  ├─ test:int
  ├─ test:bdd --tags "@smoke or @<changed-module>"
  ├─ test:e2e --grep @smoke
  ├─ test:a11y (changed pages)
  └─ trivy fs + image
       fail → cannot merge

main
  ├─ full test:bdd @P0
  ├─ full test:e2e @P0 (except @media if runner cannot)
  ├─ deploy staging
  └─ staging smoke

nightly staging
  ├─ full packs B + C + D
  ├─ @media on staging runner
  ├─ rtm.csv published
  └─ flake report (fail if new @P0 flake)
```

`@media` tests **must** run nightly. A red `@media` for 3 nights is a Blocker for beta even if PRs stay green.

---

## 14. Test architecture in the repo

```
features/                     # Gherkin, tagged
tests/
  unit/                       # or colocated next to source
  integration/
  contract/
  e2e/                        # Playwright
  perf/                       # k6
  security/                   # tenant fuzzer, header checks
  fixtures/
packages/shared/testing/      # builders: makeUser(), makeOrg(), asTenant()
docs/qa/
  rtm.csv                     # generated
  sessions/
  releases/YYYY-MM-DD.md      # signed checklist
```

**Helpers (required, stop copy-paste):** `asTenant(acme)`, `loginAs(sarah)`, `waitForWs(event)`, `mailbox()` (Mailpit API), `killSidecar('libretranslate')`.

---

## 15. Manual-only remnants (keep this list tiny)

Everything else is automated. These stay manual because they need a human or a real network:

| Check | When | Owner |
|---|---|---|
| Native-speaker translation fixture | S12, then each language-pack change | Named reviewer |
| Real iOS home-screen PWA push | S11 and beta | Release QA |
| Symmetric NAT call | S7, S12 | Engineer + phone hotspot |
| Restore drill timing | S12 | Engineer |
| Email from a real inbox (Gmail/Outlook) | S10, S12 | Release QA |
| Exploratory sessions | Every sprint | Rotating |

If a check is on this list for more than two sprints without a reason, automate it or drop it.

---

## 16. Metrics (QA is working if…)

| Metric | Healthy |
|---|---|
| P0 RTM coverage | 100% from S3 |
| Escape defects (found in prod) | 0 Blocker in beta; trend down |
| Flake rate on `@P0` | <1% of runs |
| PR time-to-green | <20 min smoke |
| Mean time to close Blocker | <1 business day |
| Exploratory sessions / sprint | ≥3 |

Review these in the sprint retro. If coverage is high and escapes are high, tests are asserting the wrong thing — fix scenarios, not the percentage.

---

## 17. Sign-off template

Copy to `docs/qa/releases/<train>-<date>.md`:

```markdown
# QA sign-off — <dogfood | private-beta | GA>
SHA: 
Images: api@  web@
Release QA: <name>
Date:

Pack A: pass/fail
Pack B journeys J1–J11: (table)
Pack C: pass/fail
Pack D: pass/fail
Pack E report: <link>
Pack F: pass/fail
Open Blocker/Critical: 0
Waivers: <ids or none>
SYS-XLANG-002: signed / n/a
Restore drill minutes: 
Decision: PASS / FAIL
```

**FAIL** means rollback or do not promote. There is no “conditional pass.”

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 1.0 | August 2026 | Initial QA strategy: gates, packs A–F, journey RTM, sprint QA, release sign-off |
| 1.1 | August 2026 | Linked to ZOQO-SDP-001 as program spine |
