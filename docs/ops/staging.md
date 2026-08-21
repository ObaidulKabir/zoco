# Staging

Staging runs the same two deployables as production — the API and the web app —
from images published by CI, behind Traefik, with Postgres, MinIO and Mailpit
alongside. It exists so the sprint review has somewhere real to look, and so
`@P0` scenarios get exercised against something other than a laptop.

## Current state

The stack is written and proven: both images build, the stack boots, and a
registration through the proxy lands as a row in Postgres. **No host is wired
up yet**, so the `deploy` and `smoke` jobs in
[deploy-staging.yml](../../.github/workflows/deploy-staging.yml) are skipped.
The `publish` job runs on every push to `main` regardless, which keeps the
images honest in the meantime.

To turn deployment on, set the repository variable `STAGING_ENABLED` to `true`
after completing the setup below.

## Wiring up a host

You need a Linux box with Docker and a DNS record pointing at it. Two vCPU and
4 GB is enough for staging; the 8 vCPU / 16 GB figure in the delivery plan is
for the pre-launch load test in Sprint 10.

**1. Point DNS.** An `A` record for the hostname you will use, and `AAAA` if the
host has IPv6. TLS issuance fails until this resolves publicly.

**2. Install Docker** and add the deploy user to the `docker` group.

**3. Write the environment file** at `~/zoqo/.env.staging` on the host, from
[.env.staging.example](../../.env.staging.example). Every secret must be
generated, not copied:

```bash
openssl rand -base64 36   # once for JWT_SECRET, again for each password
```

This file is created by hand exactly once and never leaves the host. Nothing in
CI writes it, and it is not in version control.

**4. Add the repository secrets** under Settings → Secrets and variables →
Actions:

| Secret | What it is |
|---|---|
| `STAGING_HOST` | Hostname or IP of the box |
| `STAGING_SSH_USER` | The deploy user |
| `STAGING_SSH_KEY` | Private half of a key authorised for that user |
| `STAGING_SSH_KNOWN_HOSTS` | Output of `ssh-keyscan <host>`, run somewhere you trust |

And the repository variables:

| Variable | What it is |
|---|---|
| `STAGING_URL` | Full origin, e.g. `https://staging.example.com` |
| `STAGING_ENABLED` | `true` to turn deployment on |

`STAGING_SSH_KNOWN_HOSTS` is pinned deliberately. Running `ssh-keyscan` inside
the job would accept whatever answers, which defeats the purpose of checking
at all.

**5. Push to `main`.** The workflow publishes both images, copies the stack
definition to the host, pulls, restarts, and then smoke-tests the result.

## Running it by hand

On the host:

```bash
cd ~/zoqo/infra/compose
docker compose --env-file ~/zoqo/.env.staging \
  -f docker-compose.staging.yml -f docker-compose.staging.tls.yml up -d
```

Drop the second `-f` to run without TLS, which is what you want before DNS
resolves — the ACME HTTP-01 challenge needs port 80 reachable from the
internet, and repeated failures burn through the rate limit for that domain.

Locally, without TLS and on a spare port:

```bash
TRAEFIK_HTTP_PORT=8085 docker compose --env-file .env.staging \
  -f infra/compose/docker-compose.staging.yml up -d
```

## How it fits together

Traefik is the only container with a published port. It routes `/v1`, `/health`,
`/ready` and `/docs` to the API and everything else to the web app, so both are
same-origin and there is no CORS preflight in normal use.

Routing is declared in [infra/traefik/staging](../../infra/traefik/staging)
rather than discovered from Docker labels. Label discovery means mounting the
Docker socket into the one container reachable from the internet, where a proxy
vulnerability becomes root on the host. The topology is two known services, so
the dynamic discovery buys nothing.

Migrations run as a separate `migrate` service that must exit successfully
before the API starts, so the schema is never behind the code. Re-running is
safe: the migrator keeps a ledger and applies only new files.

The API connects as `zoqo_app`, never the Postgres superuser, because Postgres
bypasses row-level security for superusers and tenant isolation would be
silently disabled. The migrator refuses to run as a superuser for the same
reason.

## Seeding

```bash
docker compose --env-file ~/zoqo/.env.staging -f docker-compose.staging.yml \
  run --rm api node dist/seed.js
```

Seed data is for staging only. The pre-launch checklist requires that it has
never been run against production.

## Mail

Staging traps all outbound mail in Mailpit and delivers nothing outbound.

Mailpit is bound to the host's loopback and is deliberately **not** routed
through Traefik. Trapped mail contains verification codes, invitation tokens and
password-reset links, so read access to that inbox is read access to every
staging account. Reach it over an SSH tunnel:

```bash
ssh -L 8025:127.0.0.1:8025 <user>@<host>
# then open http://localhost:8025
```

## What the smoke check actually covers

After each deploy CI runs, against the deployed origin:

- the `SYS-DEP-003` health scenario, which polls `/health` until it answers 200;
- the full Playwright pack, including the `@P0` journeys.

The journeys complete a real verification round trip. They register with a
per-run address, then read the six-digit code out of Mailpit through the same
SSH tunnel, exactly as a person would read their inbox. This is why
`E2E_EXPOSE_OTP` is not, and must never be, set on a deployed environment: the
code path that hands the OTP back in the API response is refused outright when
`NODE_ENV=production`.

Set `MAILPIT_URL` alongside `E2E_BASE_URL` to run them anywhere:

```bash
E2E_BASE_URL=https://staging.example.com MAILPIT_URL=http://127.0.0.1:8025 \
  pnpm test:e2e
```

Without `MAILPIT_URL` the journeys fall back to the locally booted API, which
does expose the code — fast, and needs no mail server.

One thing is still **not** covered. The BDD suite does not run against staging
and cannot as written: it builds the Nest application in-process and drives it
through supertest, so pointing it at a URL means rewriting the harness. What
runs against staging is the Playwright layer. The BDD scenarios remain the
in-process contract tests.

## Rollback

Images are tagged with the commit SHA, so rolling back is picking an older tag:

```bash
IMAGE_TAG=<short-sha> docker compose --env-file ~/zoqo/.env.staging \
  -f docker-compose.staging.yml -f docker-compose.staging.tls.yml up -d
```

Migrations do not roll back. A schema change that has to be undone needs a new
forward migration.
