-- Async Copilot — Milestone 4 background execution + action traceability
-- Makes run progression background-owned with basic retry metadata,
-- and adds durable outbound action attempt history.

alter table public.runs
  add column if not exists execution_status text not null default 'queued',
  add column if not exists execution_attempts integer not null default 0,
  add column if not exists execution_next_retry_at timestamptz,
  add column if not exists execution_lease_expires_at timestamptz,
  add column if not exists execution_last_error text;

alter table public.runs
  drop constraint if exists runs_execution_status_check;

alter table public.runs
  add constraint runs_execution_status_check
  check (execution_status in ('queued', 'running', 'retrying', 'completed', 'failed'));

update public.runs
set execution_status = case
  when state = 'failed' then 'failed'
  when state in ('completed', 'escalated') then 'completed'
  else 'queued'
end;

create index if not exists runs_execution_status_retry_idx
  on public.runs (execution_status, execution_next_retry_at);

create index if not exists runs_state_execution_created_idx
  on public.runs (state, execution_status, created_at desc);

create table if not exists public.run_action_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  response_pack_id uuid not null references public.response_packs(id) on delete cascade,
  action_intent text not null,
  action_label text not null,
  attempt_no integer not null,
  status text not null,
  target text,
  detail text,
  idempotency_key text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (run_id, action_intent, attempt_no),
  unique (idempotency_key),
  constraint run_action_attempts_status_check check (status in ('executed', 'dry_run', 'failed'))
);

create index if not exists run_action_attempts_run_attempted_idx
  on public.run_action_attempts (run_id, attempted_at desc);

create index if not exists run_action_attempts_workspace_attempted_idx
  on public.run_action_attempts (workspace_id, attempted_at desc);

alter table public.run_action_attempts enable row level security;

drop policy if exists run_action_attempts_read on public.run_action_attempts;
create policy run_action_attempts_read on public.run_action_attempts
for select to authenticated
using (public.is_workspace_member(workspace_id));
