-- Async Copilot — Milestone 4 Gmail foundation
-- Adds workspace-level Gmail connection storage, imported Gmail source rows,
-- and links Gmail-originated cases back to their source message.

do $$
begin
  alter type public.case_source add value if not exists 'gmail';
exception
  when duplicate_object then null;
end $$;

create table if not exists public.workspace_gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connected_by uuid references public.profiles(id) on delete set null,
  gmail_user_email text not null,
  google_subject text not null,
  refresh_token text not null,
  access_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

create table if not exists public.gmail_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  gmail_account_id uuid not null references public.workspace_gmail_accounts(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text not null,
  subject text,
  from_name text,
  from_email text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  sent_at timestamptz,
  snippet text,
  body_text text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, gmail_message_id)
);

alter table public.cases
  add column if not exists gmail_message_id uuid references public.gmail_messages(id) on delete set null;

create index if not exists workspace_gmail_accounts_workspace_idx
  on public.workspace_gmail_accounts (workspace_id);

create index if not exists gmail_messages_workspace_thread_idx
  on public.gmail_messages (workspace_id, gmail_thread_id, sent_at asc nulls last, created_at asc);

create index if not exists gmail_messages_workspace_imported_idx
  on public.gmail_messages (workspace_id, imported_at desc);

create unique index if not exists cases_gmail_message_unique
  on public.cases (gmail_message_id)
  where gmail_message_id is not null;

do $$
declare
  t text;
begin
  foreach t in array array['workspace_gmail_accounts', 'gmail_messages']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

alter table public.workspace_gmail_accounts enable row level security;
alter table public.gmail_messages enable row level security;

drop policy if exists workspace_gmail_accounts_read on public.workspace_gmail_accounts;
create policy workspace_gmail_accounts_read on public.workspace_gmail_accounts
for select to authenticated
using (
  public.has_workspace_role(workspace_id, array['admin']::public.workspace_role[])
);

drop policy if exists gmail_messages_read on public.gmail_messages;
create policy gmail_messages_read on public.gmail_messages
for select to authenticated
using (public.is_workspace_member(workspace_id));
