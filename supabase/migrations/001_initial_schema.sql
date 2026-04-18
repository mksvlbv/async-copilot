-- Async Copilot — initial schema
-- Migration: 001_initial_schema
-- Purpose: Cases, runs, stage evidence, response packs, sample library.
-- Scope: MVP demo, no auth, permissive RLS. All writes go through server routes.

-- =====================================================================
-- Extensions
-- =====================================================================
create extension if not exists "pgcrypto";

-- =====================================================================
-- Enums
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'run_state') then
    create type run_state as enum ('pending', 'running', 'completed', 'escalated', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'stage_state') then
    create type stage_state as enum ('pending', 'running', 'completed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'case_source') then
    create type case_source as enum ('intake', 'sample');
  end if;
  if not exists (select 1 from pg_type where typname = 'urgency_level') then
    create type urgency_level as enum ('low', 'medium', 'high');
  end if;
end $$;

-- =====================================================================
-- samples : curated scenario library (read-only in UI)
-- =====================================================================
create table if not exists public.samples (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text not null,
  body text not null,
  urgency urgency_level not null default 'medium',
  is_golden boolean not null default false,
  expected_confidence integer,
  expected_stages jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists samples_golden_idx on public.samples (is_golden) where is_golden = true;
create index if not exists samples_created_at_idx on public.samples (created_at desc);

-- =====================================================================
-- cases : support-case instances (from intake or materialized from sample)
-- =====================================================================
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  case_ref text not null unique,
  title text not null,
  body text not null,
  source case_source not null default 'intake',
  sample_id uuid references public.samples(id) on delete set null,
  customer_name text,
  customer_account text,
  customer_plan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cases_created_at_idx on public.cases (created_at desc);
create index if not exists cases_sample_id_idx on public.cases (sample_id);

-- =====================================================================
-- runs : triage lifecycle
-- =====================================================================
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  state run_state not null default 'pending',
  confidence integer,
  urgency urgency_level,
  started_at timestamptz,
  completed_at timestamptz,
  last_advanced_at timestamptz,
  advance_cursor integer not null default 0,
  total_stages integer not null default 6,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists runs_case_id_idx on public.runs (case_id);
create index if not exists runs_state_idx on public.runs (state);
create index if not exists runs_created_at_idx on public.runs (created_at desc);

-- =====================================================================
-- run_stages : per-stage progress + evidence
-- =====================================================================
create table if not exists public.run_stages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  stage_order integer not null,
  stage_key text not null,
  stage_label text not null,
  state stage_state not null default 'pending',
  duration_ms integer,
  output jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, stage_order)
);

create index if not exists run_stages_run_id_order_idx on public.run_stages (run_id, stage_order);
create index if not exists run_stages_state_idx on public.run_stages (state);

-- =====================================================================
-- response_packs : output of a completed run
-- =====================================================================
create table if not exists public.response_packs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.runs(id) on delete cascade,
  confidence integer not null,
  recommendation text,
  internal_summary text not null,
  draft_reply text not null,
  citations jsonb not null default '[]'::jsonb,
  staged_actions jsonb not null default '[]'::jsonb,
  escalation_queue text,
  approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists response_packs_run_id_idx on public.response_packs (run_id);

-- =====================================================================
-- updated_at trigger
-- =====================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['samples', 'cases', 'runs', 'run_stages', 'response_packs']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- =====================================================================
-- RLS : enable on all tables, permissive read for MVP.
-- Writes must go through server routes using secret key (bypasses RLS).
-- =====================================================================
alter table public.samples         enable row level security;
alter table public.cases           enable row level security;
alter table public.runs            enable row level security;
alter table public.run_stages      enable row level security;
alter table public.response_packs  enable row level security;

drop policy if exists samples_read on public.samples;
create policy samples_read on public.samples for select to anon, authenticated using (true);

drop policy if exists cases_read on public.cases;
create policy cases_read on public.cases for select to anon, authenticated using (true);

drop policy if exists runs_read on public.runs;
create policy runs_read on public.runs for select to anon, authenticated using (true);

drop policy if exists run_stages_read on public.run_stages;
create policy run_stages_read on public.run_stages for select to anon, authenticated using (true);

drop policy if exists response_packs_read on public.response_packs;
create policy response_packs_read on public.response_packs for select to anon, authenticated using (true);
