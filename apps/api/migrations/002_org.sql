-- Sprint 2 · org module tables (SRS §17.1) with row-level security.
--
-- RLS model: every tenant-scoped table carries org_id and a policy that compares
-- it to the `app.tenant_id` GUC set by zoqo_set_tenant(). When the GUC is unset
-- the policy is permissive, because a handful of legitimate server paths run
-- before a tenant is known -- slug uniqueness at creation, "which orgs does this
-- user belong to", and invitation lookup by token hash. Application code is the
-- primary tenant guard (OrgGuard); RLS is defence in depth that turns a missing
-- WHERE clause into an empty result instead of a leak. S12 hardening can tighten
-- this to a non-owner role once those bootstrap paths have their own grants.

create table if not exists organizations (
  id                  uuid primary key,
  name                text        not null,
  slug                text        not null,
  industry            text        not null,
  size_range          text        not null,
  country             text        not null,
  city                text,
  timezone            text        not null,
  logo_url            text,
  plan_tier           text        not null default 'free',
  storage_used_bytes  bigint      not null default 0,
  storage_limit_bytes bigint      not null default 5368709120,
  settings            jsonb       not null,
  created_at          timestamptz not null,
  updated_at          timestamptz not null default now()
);

create unique index if not exists organizations_slug_key on organizations (slug);

create table if not exists departments (
  id          uuid primary key,
  org_id      uuid not null references organizations (id) on delete cascade,
  name        text not null,
  description text not null default '',
  parent_id   uuid references departments (id) on delete set null,
  level       integer not null default 1,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint departments_level_check check (level between 1 and 5)
);

create index if not exists departments_org_id_idx on departments (org_id);

create table if not exists teams (
  id            uuid primary key,
  org_id        uuid not null references organizations (id) on delete cascade,
  department_id uuid not null references departments (id) on delete cascade,
  name          text not null,
  description   text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists teams_org_id_idx on teams (org_id);

create table if not exists org_members (
  id            uuid primary key,
  org_id        uuid not null references organizations (id) on delete cascade,
  user_id       uuid not null references users (id) on delete cascade,
  email         text not null,
  role          text not null,
  department_id uuid references departments (id) on delete set null,
  team_id       uuid references teams (id) on delete set null,
  title         text,
  joined_at     timestamptz not null,
  updated_at    timestamptz not null default now(),
  constraint org_members_role_check check (role in ('owner', 'admin', 'manager', 'member'))
);

create unique index if not exists org_members_org_user_key on org_members (org_id, user_id);
create index if not exists org_members_user_id_idx on org_members (user_id);

create table if not exists invitations (
  id            uuid primary key,
  org_id        uuid not null references organizations (id) on delete cascade,
  email         text not null,
  role          text not null,
  department_id uuid references departments (id) on delete set null,
  token_hash    text not null,
  expires_at    timestamptz not null,
  status        text not null,
  created_at    timestamptz not null default now(),
  constraint invitations_status_check check (status in ('pending', 'accepted', 'expired'))
);

create unique index if not exists invitations_token_hash_key on invitations (token_hash);
create index if not exists invitations_org_email_idx on invitations (org_id, email);

create table if not exists channels (
  id          uuid primary key,
  org_id      uuid not null references organizations (id) on delete cascade,
  name        text not null,
  slug        text not null,
  description text not null default '',
  topic       text,
  visibility  text not null default 'public',
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);

create unique index if not exists channels_org_slug_key on channels (org_id, slug);

create table if not exists channel_members (
  channel_id uuid not null references channels (id) on delete cascade,
  user_id    uuid not null references users (id) on delete cascade,
  org_id     uuid not null references organizations (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index if not exists channel_members_org_id_idx on channel_members (org_id);

create table if not exists member_profiles (
  org_id       uuid not null references organizations (id) on delete cascade,
  user_id      uuid not null references users (id) on delete cascade,
  display_name text not null default '',
  title        text not null default '',
  phone        text not null default '',
  avatar_url   text,
  timezone     text not null default 'UTC',
  language     text not null default 'en',
  bio          text not null default '',
  presence     text not null default 'offline',
  updated_at   timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists discover_profiles (
  org_id       uuid primary key references organizations (id) on delete cascade,
  display_name text not null,
  industry     text not null,
  country      text not null,
  published    boolean not null default false,
  updated_at   timestamptz not null default now()
);

-- Tenant isolation. organizations keys on id; everything else keys on org_id.
do $$
declare
  t text;
begin
  execute 'alter table organizations enable row level security';
  execute 'alter table organizations force row level security';
  -- The cast is applied to nullif(), not to the raw setting: once a transaction
  -- that ran zoqo_set_tenant() ends, the GUC reverts to '' rather than unset,
  -- and ''::uuid is an error. Postgres does not guarantee OR short-circuits, so
  -- the second branch has to be safe on its own.
  execute $p$
    create policy tenant_isolation on organizations
      using (
        nullif(current_setting('app.tenant_id', true), '') is null
        or id = nullif(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;

  foreach t in array array[
    'departments', 'teams', 'org_members', 'invitations',
    'channels', 'channel_members', 'member_profiles', 'discover_profiles'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($p$
      create policy tenant_isolation on %I
        using (
          nullif(current_setting('app.tenant_id', true), '') is null
          or org_id = nullif(current_setting('app.tenant_id', true), '')::uuid
        )
    $p$, t);
  end loop;
end
$$;
