# Sprint 1 Development Summary

## Sprint 1 Scope Delivered

### Identity and Authentication (`apps/api`)

- User registration with email/password
- Email verification with OTP
- Login with JWT access/refresh tokens
- Refresh rotation and logout/revoke flows
- Forgot/reset password flows
- Session listing and revocation

### Security and API Behavior

- `bcrypt` password hashing
- JWT guard protection on secured routes
- Standardized API envelope + HTTP status mapping
- Request ID propagation in error responses
- Auth endpoint rate-limit guard

### Persistence, Documentation, and Delivery

- Identity persistence moved from in-memory to PostgreSQL adapters
- SQL migration runner + migration files
- App DB role set to non-superuser (`zoqo_app`) with RLS-aware tenant model
- OpenAPI generated/served at `/docs` and `/docs/openapi.json`
- CI check for OpenAPI drift added
- API/Web Docker runtime paths validated
- Staging compose/workflow prepared

## Post-Sprint-1 Development Update

### Sprint 2 (Organization) — Delivered

- `org` module implemented with memberships, RBAC guard, departments, teams, profiles, and settings
- Organization migrations + tenant-scoped RLS coverage added
- Org shell/switching flows in web app delivered
- Sprint 2 QA exit automations are in place:
  - `Journey 1` Playwright green
  - `Journey 10` Playwright green
  - Invite expiry scenario automated
  - CSV junk/invalid invite scenario automated
  - RLS isolation proof present in persistence integration tests

### Sprint 3 (Messenger / DMs) — Delivered in code

- Direct messaging module landed with:
  - conversation/message use cases
  - message actions
  - typing/read/presence support paths
  - encrypted envelope + X3DH prekey bundle primitives
- BDD coverage added under `features/messenger`
- Web DM pages added under `apps/web/app/orgs/[orgId]/messages`

### Sprint 4 (Channels + Media) — Delivered in code

- Channel and thread APIs/use cases implemented
- Mentions support and shared-channel scenarios added
- Media pipeline modules and flows introduced
- BDD coverage added under `features/channels`

## Current Note on Sprint 1 Closure

- Core Sprint 1 auth deliverables are complete.
- `ORG-AUTH-003` (MFA/TOTP) is tracked as P1 in the sprint plan and remains a separate closure/promotion decision.

