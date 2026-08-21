# Sprint 1 Development Summary

## Scope Completed

### Identity and Authentication (`apps/api`)

- User registration with email and password
- Email verification flow using OTP
- Login with JWT access and refresh tokens
- Refresh token rotation
- Logout and session revocation
- Forgot-password and reset-password flow
- Session listing for active sessions

### Security and API Behavior

- Password hashing with `bcrypt`
- JWT guard protection on secured endpoints
- Standardized API error envelope and status mapping
- Request ID propagation in error responses
- Authentication rate-limiting guard for abuse control

### Persistence and Database Work

- Migration from in-memory identity persistence to PostgreSQL adapters
- SQL migration runner and migration files added
- Application DB role uses non-superuser `zoqo_app`
- Tenant-isolation pattern enforced with RLS-aware design

### Web Authentication Flows (`apps/web`)

- Register page
- Verify email page
- Login page
- Forgot password page
- Reset password page
- Token/session integration with backend auth APIs

### Documentation and QA

- Auth BDD scenarios added/extended under `features/identity`
- Unit and integration test coverage for identity/auth use cases
- OpenAPI/Swagger documentation generation and serving at:
  - `/docs`
  - `/docs/openapi.json`
- CI check added to enforce OpenAPI documentation currency

### Delivery and Runtime Readiness

- API and Web Docker build/runtime paths prepared and validated
- Staging deployment stack and workflow prepared
- Smoke-capable E2E path available against deployed environment

## Pending / Clarification for Sprint Closure

- MFA/TOTP is still pending if it is part of Sprint 1 exit criteria in your sprint plan.
- Therefore:
  - Core identity/auth deliverables are completed.
  - Full Sprint 1 closure depends on whether MFA is mandatory in your official Sprint 1 definition.

