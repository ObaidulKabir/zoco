-- Sprint 4 · Channels, Threads, Mentions & Media Attachments (SRS §17.1, §17.2, MSG-CH-001..004, MSG-TH-001..002, MSG-MEN-001, SHIELD-CORE-002) with row-level security.

-- Alter channels table to ensure full support for channel types and metadata
alter table channels add column if not exists type text not null default 'public';
alter table channels add column if not exists created_by uuid references users (id) on delete set null;
alter table channels add column if not exists updated_at timestamptz not null default now();

-- B2B shared channels organization access mapping
create table if not exists channel_shared_orgs (
  channel_id uuid not null references channels (id) on delete cascade,
  org_id     uuid not null references organizations (id) on delete cascade,
  status     text not null default 'pending', -- 'pending', 'accepted', 'revoked'
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (channel_id, org_id)
);

create index if not exists channel_shared_orgs_org_idx on channel_shared_orgs (org_id);

-- Alter channel_members to support channel roles and mute settings
alter table channel_members add column if not exists role text not null default 'member';
alter table channel_members add column if not exists is_muted boolean not null default false;

-- Channel messages with threading & broadcast support
create table if not exists channel_messages (
  id                 uuid primary key,
  channel_id         uuid not null references channels (id) on delete cascade,
  org_id             uuid not null references organizations (id) on delete cascade,
  sender_id          uuid not null references users (id) on delete cascade,
  content            text not null,
  content_ciphertext text not null default '',
  envelope_iv        text not null default '',
  envelope_tag       text not null default '',
  content_type       text not null default 'text',
  thread_id          uuid references channel_messages (id) on delete cascade,
  reply_to_id        uuid references channel_messages (id) on delete set null,
  is_broadcast       boolean not null default false,
  reply_count        integer not null default 0,
  last_reply_at      timestamptz,
  is_edited          boolean not null default false,
  edited_at          timestamptz,
  is_deleted         boolean not null default false,
  deleted_at         timestamptz,
  is_pinned          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint channel_messages_type_check check (content_type in ('text', 'system', 'file', 'call_event'))
);

create index if not exists channel_messages_channel_created_idx on channel_messages (channel_id, created_at desc);
create index if not exists channel_messages_thread_idx on channel_messages (thread_id, created_at asc);
create index if not exists channel_messages_org_idx on channel_messages (org_id);

-- Channel message mentions
create table if not exists message_mentions (
  id                 uuid primary key,
  message_id         uuid not null references channel_messages (id) on delete cascade,
  channel_id         uuid not null references channels (id) on delete cascade,
  org_id             uuid not null references organizations (id) on delete cascade,
  mentioned_user_id  uuid references users (id) on delete cascade,
  mention_type       text not null, -- 'user', 'channel', 'here', 'role'
  created_at         timestamptz not null default now()
);

create index if not exists message_mentions_user_idx on message_mentions (mentioned_user_id, created_at desc);
create index if not exists message_mentions_channel_idx on message_mentions (channel_id);

-- Self-hosted media storage & ClamAV quarantine tracking
create table if not exists media_files (
  id               uuid primary key,
  org_id           uuid not null references organizations (id) on delete cascade,
  uploader_id      uuid not null references users (id) on delete cascade,
  bucket           text not null default 'zoqo-media',
  object_key       text not null,
  filename         text not null,
  mime_type        text not null,
  size_bytes       bigint not null,
  sha256_checksum  text not null,
  scan_status      text not null default 'PENDING_SCAN', -- 'PENDING_SCAN', 'CLEAN', 'QUARANTINED'
  quarantine_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint media_files_scan_status_check check (scan_status in ('PENDING_SCAN', 'CLEAN', 'QUARANTINED'))
);

create index if not exists media_files_org_idx on media_files (org_id);
create index if not exists media_files_uploader_idx on media_files (uploader_id);

-- Row-Level Security
alter table channel_shared_orgs enable row level security;
alter table channel_shared_orgs force row level security;

alter table channel_messages enable row level security;
alter table channel_messages force row level security;

alter table message_mentions enable row level security;
alter table message_mentions force row level security;

alter table media_files enable row level security;
alter table media_files force row level security;

create policy channel_shared_orgs_tenant_isolation on channel_shared_orgs
  for all using (
    current_setting('app.tenant_id', true) is null
    or current_setting('app.tenant_id', true) = ''
    or org_id::text = current_setting('app.tenant_id', true)
  );

create policy channel_messages_tenant_isolation on channel_messages
  for all using (
    current_setting('app.tenant_id', true) is null
    or current_setting('app.tenant_id', true) = ''
    or org_id::text = current_setting('app.tenant_id', true)
  );

create policy message_mentions_tenant_isolation on message_mentions
  for all using (
    current_setting('app.tenant_id', true) is null
    or current_setting('app.tenant_id', true) = ''
    or org_id::text = current_setting('app.tenant_id', true)
  );

create policy media_files_tenant_isolation on media_files
  for all using (
    current_setting('app.tenant_id', true) is null
    or current_setting('app.tenant_id', true) = ''
    or org_id::text = current_setting('app.tenant_id', true)
  );
