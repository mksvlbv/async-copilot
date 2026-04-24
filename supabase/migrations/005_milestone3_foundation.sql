-- Async Copilot — Milestone 3 foundation
-- Adds authenticated workspace model, role boundaries, event history,
-- and tenant-aware RLS policies.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_role') then
    create type workspace_role as enum ('admin', 'reviewer', 'operator');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role workspace_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspaces_slug_idx on public.workspaces (slug);
create index if not exists workspace_memberships_user_idx on public.workspace_memberships (user_id, created_at);
create index if not exists workspace_memberships_workspace_idx on public.workspace_memberships (workspace_id, created_at);

alter table public.cases add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.cases add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.runs add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.runs add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.response_packs add column if not exists approved_by uuid references public.profiles(id) on delete set null;

create table if not exists public.run_events (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('system', 'user')),
  actor_user_id uuid references public.profiles(id) on delete set null,
  stage_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists run_events_run_id_idx on public.run_events (run_id, id);
create index if not exists run_events_workspace_id_idx on public.run_events (workspace_id, created_at desc);
create index if not exists run_events_case_id_idx on public.run_events (case_id, created_at desc);
create index if not exists cases_workspace_id_idx on public.cases (workspace_id, created_at desc);
create index if not exists runs_workspace_id_idx on public.runs (workspace_id, created_at desc);

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile on auth.users;
create trigger on_auth_user_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_auth_user_profile();

insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  updated_at = now();

insert into public.workspaces (slug, name, created_by)
values ('demo', 'Demo Workspace', null)
on conflict (slug) do update
set name = excluded.name;

update public.cases
set workspace_id = (select id from public.workspaces where slug = 'demo')
where workspace_id is null;

update public.runs r
set workspace_id = c.workspace_id
from public.cases c
where c.id = r.case_id
  and r.workspace_id is null;

alter table public.cases alter column workspace_id set not null;
alter table public.runs alter column workspace_id set not null;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = any(allowed_roles)
  );
$$;

create or replace function public.shares_workspace_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships mine
    join public.workspace_memberships theirs
      on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user_id
  );
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, workspace_role[]) to authenticated;
grant execute on function public.shares_workspace_with(uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'workspaces', 'workspace_memberships']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.run_events enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
for select to authenticated
using (auth.uid() = id or public.shares_workspace_with(id));

drop policy if exists workspaces_read on public.workspaces;
create policy workspaces_read on public.workspaces
for select to authenticated
using (public.is_workspace_member(id));

drop policy if exists workspace_memberships_read on public.workspace_memberships;
create policy workspace_memberships_read on public.workspace_memberships
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists cases_read on public.cases;
create policy cases_read on public.cases
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists runs_read on public.runs;
create policy runs_read on public.runs
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists run_stages_read on public.run_stages;
create policy run_stages_read on public.run_stages
for select to authenticated
using (
  exists (
    select 1
    from public.runs r
    where r.id = run_stages.run_id
      and public.is_workspace_member(r.workspace_id)
  )
);

drop policy if exists response_packs_read on public.response_packs;
create policy response_packs_read on public.response_packs
for select to authenticated
using (
  exists (
    select 1
    from public.runs r
    where r.id = response_packs.run_id
      and public.is_workspace_member(r.workspace_id)
  )
);

drop policy if exists run_events_read on public.run_events;
create policy run_events_read on public.run_events
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop function if exists public.search_similar_cases(text, text, uuid, int);

create or replace function public.search_similar_cases(
  query_title text,
  query_body text,
  workspace_scope uuid,
  exclude_case_id uuid default null,
  match_limit int default 5
)
returns table (
  id uuid,
  case_ref text,
  title text,
  body text,
  source text,
  customer_name text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.case_ref,
    c.title,
    c.body,
    c.source::text,
    c.customer_name,
    c.created_at,
    (
      coalesce(ts_rank(c.fts, plainto_tsquery('english', query_title || ' ' || query_body)), 0) * 0.6
      +
      coalesce(extensions.similarity(c.title, query_title), 0) * 0.4
    ) as similarity
  from public.cases c
  where c.workspace_id = workspace_scope
    and (exclude_case_id is null or c.id != exclude_case_id)
    and (
      c.fts @@ plainto_tsquery('english', query_title || ' ' || query_body)
      or extensions.similarity(c.title, query_title) > 0.1
    )
  order by similarity desc
  limit greatest(1, least(match_limit, 10));
$$;

insert into public.run_events (workspace_id, case_id, run_id, event_type, actor_type, created_at)
select r.workspace_id, r.case_id, r.id, 'run.created', 'system', r.created_at
from public.runs r
where not exists (
  select 1 from public.run_events e where e.run_id = r.id and e.event_type = 'run.created'
);

insert into public.run_events (workspace_id, case_id, run_id, event_type, actor_type, payload, created_at)
select r.workspace_id, r.case_id, r.id, 'run.started', 'system', jsonb_build_object('state', 'running'), r.started_at
from public.runs r
where r.started_at is not null
  and not exists (
    select 1 from public.run_events e where e.run_id = r.id and e.event_type = 'run.started'
  );

insert into public.run_events (workspace_id, case_id, run_id, event_type, actor_type, stage_key, payload, created_at)
select r.workspace_id, r.case_id, rs.run_id, 'stage.started', 'system', rs.stage_key,
  jsonb_build_object('stage_order', rs.stage_order, 'stage_label', rs.stage_label),
  rs.started_at
from public.run_stages rs
join public.runs r on r.id = rs.run_id
where rs.started_at is not null
  and not exists (
    select 1
    from public.run_events e
    where e.run_id = rs.run_id
      and e.event_type = 'stage.started'
      and e.stage_key = rs.stage_key
  );

insert into public.run_events (workspace_id, case_id, run_id, event_type, actor_type, stage_key, payload, created_at)
select r.workspace_id, r.case_id, rs.run_id, 'stage.completed', 'system', rs.stage_key,
  jsonb_build_object(
    'stage_order', rs.stage_order,
    'stage_label', rs.stage_label,
    'duration_ms', rs.duration_ms,
    'state', rs.state
  ),
  coalesce(rs.completed_at, rs.updated_at)
from public.run_stages rs
join public.runs r on r.id = rs.run_id
where rs.state = 'completed'
  and not exists (
    select 1
    from public.run_events e
    where e.run_id = rs.run_id
      and e.event_type = 'stage.completed'
      and e.stage_key = rs.stage_key
  );

insert into public.run_events (workspace_id, case_id, run_id, event_type, actor_type, payload, created_at)
select r.workspace_id, r.case_id, r.id, 'response_pack.created', 'system', jsonb_build_object('confidence', rp.confidence), rp.created_at
from public.response_packs rp
join public.runs r on r.id = rp.run_id
where not exists (
  select 1 from public.run_events e where e.run_id = rp.run_id and e.event_type = 'response_pack.created'
);

insert into public.run_events (workspace_id, case_id, run_id, event_type, actor_type, payload, created_at)
select r.workspace_id, r.case_id, r.id,
  case r.state
    when 'completed' then 'run.completed'
    when 'escalated' then 'run.escalated'
    else 'run.failed'
  end,
  'system',
  jsonb_build_object('state', r.state, 'confidence', r.confidence, 'urgency', r.urgency),
  coalesce(r.completed_at, r.updated_at)
from public.runs r
where r.state in ('completed', 'escalated', 'failed')
  and not exists (
    select 1
    from public.run_events e
    where e.run_id = r.id
      and e.event_type = case r.state
        when 'completed' then 'run.completed'
        when 'escalated' then 'run.escalated'
        else 'run.failed'
      end
  );

insert into public.run_events (workspace_id, case_id, run_id, event_type, actor_type, actor_user_id, payload, created_at)
select r.workspace_id, r.case_id, r.id, 'response_pack.approved', 'user', rp.approved_by,
  jsonb_build_object('approved', true),
  rp.approved_at
from public.response_packs rp
join public.runs r on r.id = rp.run_id
where rp.approved = true
  and rp.approved_at is not null
  and not exists (
    select 1 from public.run_events e where e.run_id = rp.run_id and e.event_type = 'response_pack.approved'
  );
