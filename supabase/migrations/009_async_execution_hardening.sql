-- Async Copilot — Milestone 4 hardening
-- Prevent duplicate background claims and reserve action attempts before dispatch.

alter table public.runs
  add column if not exists execution_claim_token uuid;

create unique index if not exists runs_id_workspace_unique_idx
  on public.runs (id, workspace_id);

create unique index if not exists response_packs_id_run_unique_idx
  on public.response_packs (id, run_id);

alter table public.run_action_attempts
  drop constraint if exists run_action_attempts_status_check;

alter table public.run_action_attempts
  add constraint run_action_attempts_status_check
  check (status in ('pending', 'executed', 'dry_run', 'failed'));

alter table public.run_action_attempts
  drop constraint if exists run_action_attempts_run_workspace_fkey;

alter table public.run_action_attempts
  add constraint run_action_attempts_run_workspace_fkey
  foreign key (run_id, workspace_id)
  references public.runs (id, workspace_id)
  on delete cascade;

alter table public.run_action_attempts
  drop constraint if exists run_action_attempts_response_pack_run_fkey;

alter table public.run_action_attempts
  add constraint run_action_attempts_response_pack_run_fkey
  foreign key (response_pack_id, run_id)
  references public.response_packs (id, run_id)
  on delete cascade;
