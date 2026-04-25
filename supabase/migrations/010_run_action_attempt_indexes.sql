-- Async Copilot — action attempt index coverage
-- Covers newly added composite foreign keys and actor lookup paths.

create index if not exists run_action_attempts_run_workspace_idx
  on public.run_action_attempts (run_id, workspace_id);

create index if not exists run_action_attempts_response_pack_run_idx
  on public.run_action_attempts (response_pack_id, run_id);

create index if not exists run_action_attempts_actor_user_idx
  on public.run_action_attempts (actor_user_id);
