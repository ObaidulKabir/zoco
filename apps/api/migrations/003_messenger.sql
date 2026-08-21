-- Sprint 3 · messenger module tables (SRS §17.1, §17.2, MSG-DM-001..005, SHIELD-CORE-001) with row-level security.

create table if not exists conversations (
  id          uuid primary key,
  org_id      uuid not null references organizations (id) on delete cascade,
  type        text not null default 'dm',
  channel_id  uuid references channels (id) on delete cascade,
  created_by  uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint conversations_type_check check (type in ('dm', 'channel', 'b2b_dm', 'b2b_shared'))
);

create index if not exists conversations_org_id_idx on conversations (org_id);
create index if not exists conversations_channel_id_idx on conversations (channel_id);

create table if not exists conversation_participants (
  id              uuid primary key,
  conversation_id uuid not null references conversations (id) on delete cascade,
  user_id         uuid not null references users (id) on delete cascade,
  org_id          uuid not null references organizations (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz,
  is_muted        boolean not null default false,
  unique (conversation_id, user_id)
);

create index if not exists conv_participants_conv_idx on conversation_participants (conversation_id);
create index if not exists conv_participants_user_idx on conversation_participants (user_id);
create index if not exists conv_participants_org_idx on conversation_participants (org_id);

create table if not exists messages (
  id                 uuid primary key,
  conversation_id    uuid not null references conversations (id) on delete cascade,
  org_id             uuid not null references organizations (id) on delete cascade,
  sender_id          uuid not null references users (id) on delete cascade,
  content_ciphertext text not null,
  envelope_iv        text not null default '',
  envelope_tag       text not null default '',
  content_type       text not null default 'text',
  reply_to_id        uuid references messages (id) on delete set null,
  is_edited          boolean not null default false,
  edited_at          timestamptz,
  is_deleted         boolean not null default false,
  deleted_at         timestamptz,
  is_pinned          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint messages_content_type_check check (content_type in ('text', 'system', 'file', 'call_event'))
);

create index if not exists messages_conv_created_idx on messages (conversation_id, created_at desc);
create index if not exists messages_org_id_idx on messages (org_id);
create index if not exists messages_sender_id_idx on messages (sender_id);

create table if not exists message_reactions (
  id         uuid primary key,
  message_id uuid not null references messages (id) on delete cascade,
  org_id     uuid not null references organizations (id) on delete cascade,
  user_id    uuid not null references users (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists msg_reactions_msg_idx on message_reactions (message_id);
create index if not exists msg_reactions_org_idx on message_reactions (org_id);

create table if not exists message_receipts (
  id         uuid primary key,
  message_id uuid not null references messages (id) on delete cascade,
  org_id     uuid not null references organizations (id) on delete cascade,
  user_id    uuid not null references users (id) on delete cascade,
  status     text not null default 'delivered',
  read_at    timestamptz not null default now(),
  constraint msg_receipts_status_check check (status in ('delivered', 'read')),
  unique (message_id, user_id, status)
);

create index if not exists msg_receipts_msg_idx on message_receipts (message_id);
create index if not exists msg_receipts_org_idx on message_receipts (org_id);

create table if not exists prekey_bundles (
  user_id                 uuid primary key references users (id) on delete cascade,
  identity_key            text not null,
  signed_prekey           text not null,
  signed_prekey_signature text not null,
  one_time_prekeys        jsonb not null default '[]'::jsonb,
  updated_at              timestamptz not null default now()
);

-- RLS policies
do $$
declare
  t text;
begin
  foreach t in array array[
    'conversations', 'conversation_participants', 'messages',
    'message_reactions', 'message_receipts'
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
