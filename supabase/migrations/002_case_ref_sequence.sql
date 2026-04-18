-- Migration 002: replace application-side `nextCaseRef` with a Postgres sequence.
-- Removes the read-modify-write race in POST /api/cases.
-- Idempotent: safe to re-run.

create sequence if not exists public.case_ref_seq
  start with 9000  -- safely past any existing CASE-89xx values seeded in 002_golden_run
  increment by 1;

-- Future inserts get case_ref from the sequence automatically.
alter table public.cases
  alter column case_ref set default ('CASE-' || nextval('public.case_ref_seq'));

-- If the sequence somehow lags behind an existing max (e.g. re-seed on a
-- populated DB), fast-forward it so the next value is guaranteed unique.
do $$
declare
  max_n integer;
begin
  select coalesce(max((regexp_match(case_ref, 'CASE-(\d+)'))[1]::int), 8999)
    into max_n
    from public.cases
    where case_ref ~ '^CASE-\d+$';

  if max_n >= nextval('public.case_ref_seq') - 1 then
    perform setval('public.case_ref_seq', max_n + 1, false);
  end if;
end $$;
