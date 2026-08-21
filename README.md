# Zoqo

Unified B2B communication (workspace, messaging, meetings). Phase 1 is a hexagonal **modular monolith**: NestJS API + Next.js PWA. No paid SaaS accounts are required to run locally (`SYS-DEP-003`).

## Prerequisites

- Node 20+
- [pnpm 9](https://pnpm.io) (`corepack enable` then `corepack prepare pnpm@9.12.0 --activate`, or `npx pnpm@9.12.0`)
- Docker Desktop (for Compose sidecars)

## Quick start

```powershell
Copy-Item .env.example .env
pnpm install
pnpm check:ports
pnpm compose:minimal
pnpm --filter @zoqo/api dev
pnpm --filter @zoqo/web dev
```

`pnpm check:ports` (also run automatically by `compose:minimal`) refuses to bind if Postgres, Apache, or another app already owns a host port. When that happens, set the suggested `*_PORT` in `.env` and keep `DATABASE_URL` / `NEXT_PUBLIC_API_URL` in sync.

Then open (ports from `.env`):

- API health: http://localhost:3001/health
- API docs: http://localhost:3001/docs (raw document at `/docs/openapi.json`)
- Web shell: http://localhost:3000
- Mailpit: http://localhost:8025
- MinIO console: http://localhost:9001 (user/pass from `.env.example`)

Compose profiles:

| Profile | What it adds |
|---|---|
| `default` / `minimal` | Postgres, Valkey, RabbitMQ, MinIO, Traefik, Mailpit |
| `media` | ClamAV, LiveKit, coturn |
| `translation` | LibreTranslate (heavy; skip on 8 GB machines) |
| `obs` | Prometheus, Grafana, Loki, GlitchTip, Uptime Kuma |
| `test` | Same data plane as `minimal`, for CI |

On 8 GB RAM: `pnpm compose:minimal` (checks ports, then Compose `--profile minimal`).

LibreTranslate is **not** on the minimal profile. Combine with `--profile translation` when you have RAM.

## Persistence

The API runs on in-memory stores until you opt into Postgres, so a fresh clone
works without a database. Data written in that mode lives only as long as the
process.

```powershell
pnpm compose:minimal      # Postgres on the port from .env
pnpm migrate              # apply apps/api/migrations in order
# set PERSISTENCE=postgres in .env
pnpm seed                 # Acme + Nodi Traders QA personas
```

`PERSISTENCE` is the switch, not `DATABASE_URL`, because `.env.example` ships a
connection string. Production refuses to start on anything but `postgres`.

Tenant isolation is enforced twice: `OrgGuard` checks membership, and every
org-scoped statement runs inside a transaction with the `app.tenant_id` GUC set,
which the row-level security policies in `002_org.sql` match against `org_id`.

The API connects as `zoqo_app`, never as the Postgres superuser. Superusers
bypass row-level security, so a superuser connection would disable tenant
isolation without raising a single error; `pnpm migrate` refuses to run as one.
The Compose stack creates `zoqo_app` at first boot from `APP_DB_PASSWORD`.

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:int
pnpm test:bdd
pnpm test:boundaries
pnpm check:no-saas
```

The persistence and RLS suite in `tests/integration/persistence.int.spec.ts`
skips unless `TEST_DATABASE_URL` points at a throwaway database. CI always sets
it, so it never silently skips there.

Point it at an admin role on a database you don't mind losing; the suite creates
the non-superuser `zoqo_app` role itself and migrates as that, so the policies
are exercised the same way production runs them.

```powershell
docker run -d --name zoqo-test-pg -e POSTGRES_USER=zoqo -e POSTGRES_PASSWORD=zoqo `
  -e POSTGRES_DB=zoqo_test -p 55432:5432 postgres:16-alpine
$env:TEST_DATABASE_URL = 'postgresql://zoqo:zoqo@localhost:55432/zoqo_test'
pnpm test:int
```

BDD `SYS-DEP-003` is a static PR smoke by default (no live Compose). To wait for a running stack:

```powershell
$env:ZOQO_BDD_INFRA = '1'
pnpm test:bdd
```

## Staging

The staging stack, the deploy workflow and the runbook live in
[docs/ops/staging.md](./docs/ops/staging.md). Images publish on every push to
`main`; deployment turns on once a host is wired up and `STAGING_ENABLED` is
set.

## API documentation

The OpenAPI document is generated from the controllers, served at `/docs`, and
committed to [docs/api/openapi.json](./docs/api/openapi.json) so changes to the
contract show up in review.

```powershell
pnpm openapi         # regenerate the committed document
pnpm openapi:check   # CI gate: fails if it is stale or a route is undocumented
```

Every route needs a summary, a tag and at least one documented response, which
is what makes the "endpoints join the document in the same PR" rule enforceable
rather than aspirational.

## Architecture

See [docs/adr/0001-modular-monolith.md](./docs/adr/0001-modular-monolith.md) and [ZOQO-SRS-001.md](./ZOQO-SRS-001.md).
