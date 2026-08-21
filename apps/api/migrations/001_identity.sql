-- Sprint 1 · identity module tables (SRS §17.1).
-- Identity is deliberately tenant-less: a person exists before any organization
-- does (ORG-AUTH sprint exit, "tenant-less user can exist"), so these tables
-- carry no tenant_id and no RLS policy. Tenant scoping starts in 002_org.sql.

create table if not exists users (
  id                        uuid primary key,
  email                     text        not null,
  full_name                 text        not null,
  password_hash             text        not null,
  status                    text        not null,
  failed_at                 timestamptz[] not null default '{}',
  locked_until              timestamptz,
  password_history          text[]      not null default '{}',
  email_otp_hash            text,
  email_otp_expires_at      timestamptz,
  password_reset_hash       text,
  password_reset_expires_at timestamptz,
  avatar_url                text,
  phone                     text,
  timezone                  text        not null default 'UTC',
  language                  text        not null default 'en',
  mfa_enabled               boolean     not null default false,
  last_login_at             timestamptz,
  created_at                timestamptz not null,
  updated_at                timestamptz not null default now(),
  constraint users_status_check
    check (status in ('pending_verification', 'active', 'locked', 'suspended'))
);

-- Registration lower-cases the address, so a plain unique index is enough and
-- avoids depending on the citext extension.
create unique index if not exists users_email_key on users (email);

create table if not exists sessions (
  id                 uuid primary key,
  user_id            uuid        not null references users (id) on delete cascade,
  refresh_token_hash text        not null,
  user_agent         text        not null default '',
  ip                 text        not null default '',
  created_at         timestamptz not null,
  last_active_at     timestamptz not null,
  expires_at         timestamptz not null
);

create index if not exists sessions_user_id_idx on sessions (user_id);

-- SHIELD-CORE-002: append-only. No update or delete policy is granted; the
-- audit UI and retention job arrive in S12.
create table if not exists audit_log (
  id       bigserial primary key,
  type     text        not null,
  user_id  uuid,
  email    text,
  ip       text        not null default '',
  at       timestamptz not null,
  meta     jsonb       not null default '{}'::jsonb
);

create index if not exists audit_log_at_idx on audit_log (at desc);
create index if not exists audit_log_type_idx on audit_log (type);

-- ORG-AUTH-001: lets registration prove an invite token was issued to the email
-- being registered before it reveals the OTP in-app. A projection of the org
-- module's invitations, owned by identity so the dependency stays one-way.
create table if not exists invite_email_tokens (
  token_hash text        primary key,
  email      text        not null,
  expires_at timestamptz not null
);
