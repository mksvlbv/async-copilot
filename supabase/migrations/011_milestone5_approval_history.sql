-- Async Copilot — Milestone 5 approval history
-- Adds a durable approval history record per approved response pack.

create table if not exists public.response_pack_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null,
  response_pack_id uuid not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (response_pack_id),
  constraint response_pack_approvals_run_workspace_fkey
    foreign key (run_id, workspace_id)
    references public.runs (id, workspace_id)
    on delete cascade,
  constraint response_pack_approvals_response_pack_run_fkey
    foreign key (response_pack_id, run_id)
    references public.response_packs (id, run_id)
    on delete cascade
);

create index if not exists response_pack_approvals_run_approved_idx
  on public.response_pack_approvals (run_id, approved_at desc);

create index if not exists response_pack_approvals_actor_user_idx
  on public.response_pack_approvals (actor_user_id);

alter table public.response_pack_approvals enable row level security;

drop policy if exists response_pack_approvals_read on public.response_pack_approvals;
create policy response_pack_approvals_read on public.response_pack_approvals
for select to authenticated
using (public.is_workspace_member(workspace_id));

insert into public.response_pack_approvals (
  workspace_id,
  run_id,
  response_pack_id,
  actor_user_id,
  actor_label,
  approved_at
)
select
  r.workspace_id,
  r.id,
  rp.id,
  rp.approved_by,
  coalesce(p.full_name, p.email),
  rp.approved_at
from public.response_packs rp
join public.runs r on r.id = rp.run_id
left join public.profiles p on p.id = rp.approved_by
where rp.approved = true
  and rp.approved_at is not null
on conflict (response_pack_id) do nothing;
