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

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:bdd
pnpm test:boundaries
pnpm check:no-saas
```

BDD `SYS-DEP-003` is a static PR smoke by default (no live Compose). To wait for a running stack:

```powershell
$env:ZOQO_BDD_INFRA = '1'
pnpm test:bdd
```

## Architecture

See [docs/adr/0001-modular-monolith.md](./docs/adr/0001-modular-monolith.md) and [ZOQO-SRS-001.md](./ZOQO-SRS-001.md).
