# ADR-0001: Modular monolith (Phase 1)

**Status:** Accepted  
**Date:** 2026-08-20  
**SRS:** §4.4–§4.9

## Context

Zoqo is a multi-tenant B2B communication platform with several bounded contexts (identity, org, messaging, meetings, and others). A microservices split on day one would multiply operational cost (ten deployables, ten databases, distributed tracing) before the product has users.

## Decision

Phase 1 is a **hexagonal modular monolith**:

- One NestJS process: `apps/api`
- One Next.js PWA: `apps/web`
- Bounded contexts as Nest modules under `apps/api/src/modules/*`
- Persistence is Postgres (JSONB for messages/notifications). No MongoDB, no Elasticsearch.
- Contexts **must not** query each other's tables. They collaborate through application ports and the event bus.
- Vendor SDKs live only in `infrastructure/` drivers. Domain and application layers stay free of Nest, HTTP, and cloud APIs.

Sidecars (Compose): Postgres 16, Valkey 8, RabbitMQ, MinIO, Traefik v3, Mailpit, ClamAV, LiveKit, coturn, LibreTranslate (profile), observability (profile).

## Consequences

- We can extract a context to its own process later without rewriting use cases, by swapping drivers.
- ESLint `boundaries` forbids `domain → infrastructure` imports (enforced in CI).
- Horizontal scale is process replicas + Postgres, not a service mesh.

## Alternatives considered

- **Nx microservices from Sprint 0:** rejected; violates SRS Phase 1 physical architecture.
- **Shared database joins across modules:** rejected; would make a later split impossible.
