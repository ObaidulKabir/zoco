# Zoqo — Software Development Plan (SDP)
## Document ID: ZOQO-SDP-001 · Version 1.0 · August 2026

| Field | Detail |
|---|---|
| **Status** | Draft — sign before Sprint 0 |
| **Companion to** | [ZOQO-SRS-001](./ZOQO-SRS-001.md) · [ZOQO-SPRINTS-001](./ZOQO-SPRINTS-001.md) · [ZOQO-QA-001](./ZOQO-QA-001.md) |
| **Purpose** | Run the program. The SRS is **what**, sprints are **when**, QA is **how we prove it**. This file is **how we operate** until code exists and after. |
| **Rule** | No `apps/` code until §12 (Ready for Sprint 0) is ticked. |

---

## 1. Program charter

**Zoqo** is a self-hosted, multi-tenant B2B platform: internal chat, B2B chat, calls, approvals, and a business directory — in one product, with **cross-language messaging** so two companies can each write in their own language.

**Phase 1 outcome (private beta):** an installable PWA on **one Linux host**, Docker Compose, zero paid SaaS accounts, all **11 P0 journeys** green on staging per [ZOQO-QA-001](./ZOQO-QA-001.md).

**Phase 1 non-goals (do not build):**

- Google / Microsoft OAuth
- Flutter / App Store / Play Store
- Stripe or any paid API (DeepL, OpenAI, FCM, SES as primary)
- Kubernetes, MongoDB, Elasticsearch, Redis-licensed 7.4+
- Insights dashboards, visual workflow builder, meeting recording

Those have homes in Phase 2–3 ([ZOQO-SPRINTS-001](./ZOQO-SPRINTS-001.md) §6–§7).

**Success metrics (Phase 1 beta):**

| Metric | Target |
|---|---|
| P0 journeys J1–J11 | All green on staging |
| QA packs A–F | Signed pass ([ZOQO-QA-001](./ZOQO-QA-001.md) §12.3) |
| Software licences | $0 recurring |
| Infra cost | ≤ ~$140 / month |
| Uptime commitment | 99.0% (no public SLA) |
| Friendly orgs on beta | 5–10 |

**Program complete** means end of Sprint 48 (GA mobile + billing at S24; v2.0 enterprise/scale/desktop at S48). This SDP governs **Phase 1** in detail; Phases 2–3 inherit the same operating system unless a later SDP revision says otherwise.

---

## 2. Document map and change control

```
ZOQO-SDP-001     how we run the program (this file)
       ├── ZOQO-SRS-001       what to build (requirements + architecture)
       ├── ZOQO-SPRINTS-001   when (S0–S48, vertical slices)
       └── ZOQO-QA-001        how we pass QA (packs, RTM, sign-off)
```

| Need | Authority | Change rule |
|---|---|---|
| New user-visible behaviour | SRS | Version increment + `SYS-DEV-010` |
| Sprint order / slice timing | SPRINTS | Patch the playbook; do not skip P0 |
| What “QA passed” means | QA | Version increment |
| Roles, RAID, go-live, Sprint 0 gate | **This SDP** | Version increment |
| Hexagonal layout, monolith vs services | SRS §4 | ADR in `docs/adr/` + SRS increment if it contradicts §4 (`SYS-ARCH-003`) |

**Conflict rule:** SRS wins on product behaviour. SDP wins on process. Sprints win on sequence. QA wins on release evidence. If two files disagree, amend the lower-authority file in the same PR as the work — do not “interpret.”

---

## 3. Assumptions

| ID | Assumption | If false |
|---|---|---|
| A1 | **3** full-stack engineers | Keep sprint **order**; stretch to 3-week sprints or drop P1 (org chart, MFA if slipped, lobby, search UI) |
| A2 | **2-week** sprints | Same |
| A3 | Illustrative start **2026-09-01** | Shift the gantt; do not reorder P0 |
| A4 | Product owner exists (can cut scope and sign beta) | An engineer must not self-sign beta |
| A5 | Staging VPS exists by Sprint 10 (email/DNS); **S0–S9 can be local-only** | Beta blocked, not S0 |
| A6 | No separate QA hire in Phase 1 | Engineers own tests; rotate Release QA |
| A7 | Domain name will be acquired before public URLs (S10+) | Use `localhost` / `staging.zoqo.test` until then |

---

## 4. Roles and RACI

Phase 1 is a small team. Titles are **hats**, not headcount.

| Hat | Who | Accountable for |
|---|---|---|
| **Product owner** | Named person (not the whole team) | Scope, P0 vs cut, beta “go”, `SYS-XLANG-002` signer assignment |
| **Engineer** | Each of the three | Modules they touch: tests, migrations, runbook notes (`SYS-DEV-008`) |
| **Release QA** | Rotates each **train** (dogfood, beta, GA) | Packs A–F evidence, sign-off file in `docs/qa/releases/` |
| **Ops** | One engineer, default the one who set up Compose | Host, DNS, backups, Traefik, alerts |
| **Security reviewer** | Other than the author of the PR | Tenant tests, no vendor SDK outside drivers |

**RACI (R = does, A = accountable, C = consulted, I = informed):**

| Decision | PO | Engineer | Rel. QA | Ops |
|---|---|---|---|---|
| Add a P0 feature | A | C | I | I |
| Merge PR to `main` | I | R | C | I |
| Declare sprint Done | A | R | R | I |
| Promote dogfood / beta | A | C | R | C |
| Open a paid vendor (`SYS-DEP-006`) | A | C | I | C |
| Production deploy | A | C | C | R |
| Incident P1 | I | R | I | A |

**Beta signatories:** Product owner + Release QA. Ops confirms restore drill and DNS. No single-person beta.

---

## 5. Work breakdown

**Physical deployables (Phase 1):** only `apps/api` (NestJS modular monolith) and `apps/web` (Next.js PWA). Everything else is a sidecar (Postgres, Valkey, RabbitMQ, MinIO, Traefik, LiveKit, coturn, LibreTranslate, ClamAV, Mailpit/Postfix).

| Bounded context | Owns | Sprints | Notes |
|---|---|---|---|
| Platform / shared | Ports, tenant context, CI, Compose | **0** | Walking skeleton only |
| Identity | Users, sessions, MFA, JWT | **1** | Thin `MailerPort` |
| Org | Tenants, members, roles, departments | **2** | Default channel **rows**; messaging later |
| Messenger | DMs, channels, B2B, files, FTS | **3–6** | Translate is its own module, same sprints |
| Translate | Detect, jobs, cache rules | **6** | LibreTranslate internal-only |
| Files | Upload, ClamAV, quota | **6** | |
| Meet | LiveKit, schedule | **7–8** | May start after S3 in parallel |
| Flow | Templates, instances, actions | **9** | May start after S2 in parallel |
| Notify | Bell, email, Web Push, prefs | **10** | **Stubs from S3**; replace in S10 |
| Discover | Profiles, directory, PWA install | **11** | |
| Shield | Audit UI, rate-limit finish, E2E crypto finish | **12** | Middleware **from S1** |

Detail and stories: [ZOQO-SPRINTS-001](./ZOQO-SPRINTS-001.md). Requirements: SRS modules 7–15.

---

## 6. Engineering operating system

### 6.1 Repo (from SRS §4.9)

```
zoqo/
├── apps/api/                 # NestJS modular monolith
├── apps/web/                 # Next.js PWA
├── packages/shared/          # ports, DTOs, events, tenant
├── packages/ui/
├── packages/config/
├── features/                 # Gherkin
├── infra/compose/
├── tests/
└── docs/                     # SRS, SDP, sprints, QA, adr/, qa/releases/
```

Two application images. New capability = **module**, not a new service (`SYS-DEV-003`).

### 6.2 Method

Outside-in **BDD + TDD** (SRS §21). Sequence for every SRS ID: Gherkin (red) → contract → TDD use case → adapter → UI last.

### 6.3 Definition of Ready (story may start)

- [ ] SRS ID exists and is in this sprint’s table
- [ ] Gherkin drafted with `@SRS-ID` and `@P0`/`@P1`
- [ ] Persona from QA seed list is named
- [ ] No unpaid design question that would change the API

### 6.4 Definition of Done

SRS §21.5 **and** sprint QA list in QA §10. Coverage: 90% on changed `domain/` + `application/`; 80% repo.

### 6.5 Git and PR

- `main` always deployable. Branch `feat/ORG-AUTH-002-login`
- Conventional Commits with SRS ID
- One approving review; squash merge
- **No Gitflow**
- PR template: SRS ID, scenarios, coverage, tenant test

### 6.6 Inner loop

```bash
pnpm test:unit
pnpm test:int
pnpm test:bdd
pnpm test:e2e
pnpm lint
pnpm typecheck
docker compose up
docker compose --profile minimal up
```

Unit tests must run **without** Docker.

---

## 7. Environments and go-live

| Env | When required | URL |
|---|---|---|
| Local Compose | Sprint 0 day 1 | `localhost` |
| CI (ephemeral Compose) | Sprint 0 when Actions exist | — |
| Staging VPS | By Sprint 10 (real mail); earlier is better | `staging.zoqo.com` (or `.test` until domain) |
| Production host | Sprint 12 | `app.zoqo.com` |

**Host spec (prod):** 16 vCPU / 64 GB / 1 TB NVMe recommended (SRS §20.1). Staging: 8 vCPU / 16 GB, reduced language pack.

**Go-live checklist (ops, before first public URL):**

- [ ] Domain registered
- [ ] A/AAAA records → staging and prod
- [ ] Traefik Let’s Encrypt working
- [ ] SPF, DKIM, DMARC, **PTR** for mail
- [ ] Admin UIs (Grafana, MinIO, Rabbit, GlitchTip, LibreTranslate) **not** on the public internet
- [ ] SOPS age key held off the server
- [ ] `restic` + `pgBackRest` destinations on a **second** provider
- [ ] Uptime Kuma + Alertmanager reachable to Ops
- [ ] Seed **not** run on production (QA personas are staging-only)

**Release trains** (from sprints §8):

| Train | After sprint | QA bar |
|---|---|---|
| Internal dogfood | 6 | QA §12.2 |
| Private beta | 12 | QA §12.3 (J1–J11 + packs C–F) |
| Public beta | ~16 | Multi-node / OAuth as then in scope |
| GA | 24 | QA §12.4 |
| v2.0 | 48 | SDP/SRS Phase 3 exit |

---

## 8. RAID log

### Risks

| ID | Risk | Likelihood | Impact | Mitigation | Owner hat |
|---|---|---|---|---|---|
| R1 | Self-hosted email lands in spam | H | H | SPF/DKIM/DMARC/PTR; in-app OTP; `MailerPort` exception if <95% | Ops |
| R2 | Calls fail behind NAT | M | H | coturn in S0; NAT test day S7 | Engineer (Meet) |
| R3 | LibreTranslate weak on bn | M | H | Fixture S6; human sign-off S12; DeepL only with `SYS-DEP-006` | PO + Rel. QA |
| R4 | E2E encryption slips | M | H | Server-side encryption first; finish ratchet in S12; DMs not blocked | Engineer (Messenger) |
| R5 | Single host = 99.0% not 99.9% | H | M | Documented; backups; 4 h rebuild runbook | Ops |
| R6 | Sprint 6 overloaded | M | M | Search UI may slip to S11; **translation does not slip** | PO |
| R7 | Notify “late” | L | M | Stubs from S3 | Engineer |
| R8 | Team of 1–2 | L | H | Stretch cadence; cut P1 | PO |
| R9 | Flaky `@P0` tests hide bugs | M | H | Flakes = High defects (QA-006) | Rel. QA |
| R10 | Scope creep | M | H | `SYS-DEV-010`; this SDP §2 | PO |

### Assumptions

See §3.

### Issues

None at SDP v1.0 (no code yet). Track in GitHub Issues with labels `raid`, `blocker`.

### Dependencies

| Depends on | Needed by | Notes |
|---|---|---|
| Domain + PTR | S10 email in real inboxes | Optional before S10 |
| Staging host | Nightly packs B–D | Can use a spare machine |
| Native speakers (bn, hi, ar) | S12 `SYS-XLANG-002` | Name them before S6 |
| Apple/Google accounts | Phase 2 Flutter | Not Phase 1 |

---

## 9. Security and compliance (Phase 1)

In scope now:

- TLS 1.3, HSTS, CSP
- JWT 15 min / refresh 30 d rotation
- bcrypt 12; lockout 5 / 15 min
- RLS + `tenant_id` from auth context; Pack C every `main`
- Audit middleware from **Sprint 1**; UI/export Sprint 12
- SOPS + age; no secrets in git plaintext
- ClamAV before file is readable
- E2E DMs/B2B: server must not store plaintext (QA Pack C)
- LibreTranslate not published on a host port
- Licence scan; no SSPL/Elastic in the app

Out of Phase 1: SOC 2 certification, GDPR export tooling (Phase 2), SSO/SAML (Phase 3), paid pen-test vendor (optional S12 internal suite is the bar).

---

## 10. Support after beta

| Item | Practice |
|---|---|
| Watch | GlitchTip, Uptime Kuma, Grafana (CPU, disk, TURN bandwidth, mail queue) |
| Hours | Best-effort for private beta; no 24/7 ROTA until GA |
| Sev 1 | Site down or cross-tenant leak — page Ops; rollback Compose to previous images |
| Sev 2 | Mail or Translate down — chat must still work; fix within 1 business day |
| Rollback | Previous `api`/`web` tags; database **forward-only** (expand/migrate/contract). If a migration cannot roll forward, it does not ship |
| Comms | Beta orgs: status note from PO within 4 h for Sev 1 |

---

## 11. Decisions log

### Already decided (do not reopen in Slack)

| Decision | Where |
|---|---|
| Self-hosted, zero paid SaaS in Phase 1 | SRS §1.4, §2.4 |
| Modular monolith + hexagonal modules | SRS §4.4–§4.6 |
| Postgres JSONB, Valkey, Traefik, MinIO, LibreTranslate | SRS §3 |
| BDD + TDD; two-week vertical slices | SRS §21, SPRINTS |
| QA pass = packs + sign-off | QA-001 |
| PWA first; Flutter Phase 2 | SRS §3.4 |

### Open (must close by the sprint shown)

| ID | Question | Close by | Default if unanswered |
|---|---|---|---|
| D1 | Calendar start date | Before S0 | 2026-09-01 |
| D2 | VPS provider (Hetzner / DO / OVH / bare metal) | S10 | Cheapest that meets §20.1 spec |
| D3 | Production domain | S10 | `zoqo.com` placeholder in docs only |
| D4 | Named product owner | **S0 gate** | Block Sprint 0 |
| D5 | Who signs `SYS-XLANG-002` (bn, hi, ar) | S6 | Block beta, not S0 |
| D6 | pnpm vs npm vs yarn | S0 day 1 | **pnpm** (lockfile in repo) |
| D7 | Nx vs Turborepo | S0 day 1 | **Turborepo** (lighter) unless team already knows Nx |

---

## 12. Gate: ready for Sprint 0

**Do not generate `apps/` code until every box is ticked.**

### Documents

- [ ] SRS v1.5+ read by the team (architecture §4, constraints §2.4, MVP §6)
- [ ] SPRINTS-001: Sprint 0–2 understood
- [ ] QA-001: Pack A and traceability model understood
- [ ] **This SDP** reviewed; open D4 (product owner) filled in below

### People

- [ ] Product owner named: __________________
- [ ] Three engineers (or explicit A1 exception): __________________
- [ ] First Release QA (dogfood train): __________________
- [ ] Ops hat: __________________

### Tooling (accounts that are **allowed** — git host only)

- [ ] Git remote exists (GitHub/GitLab/self-hosted)
- [ ] No Google/Apple/Stripe/Sentry-cloud accounts created “just in case”

### Hosting (optional for S0)

- [ ] N/A for local-only S0 **or** staging VPS ordered

### Sign

| Role | Name | Date |
|---|---|---|
| Product owner | | |
| Ops | | |

When this page is signed, Sprint 0 in [ZOQO-SPRINTS-001](./ZOQO-SPRINTS-001.md) may start.

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 1.0 | August 2026 | Initial SDP: charter, document map, RACI, WBS, operating system, RAID, go-live, Sprint 0 gate |
