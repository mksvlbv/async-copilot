-- Daily platform metrics snapshot (populated by Vercel Cron)
create table if not exists daily_stats (
  date       date primary key,
  total_cases      int not null default 0,
  total_runs       int not null default 0,
  completed_runs   int not null default 0,
  escalated_runs   int not null default 0,
  failed_runs      int not null default 0,
  created_at       timestamptz not null default now()
);

-- RLS: read-only public, write via service role only
alter table daily_stats enable row level security;

create policy "daily_stats_read" on daily_stats
  for select using (true);
