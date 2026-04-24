-- Prevent duplicate timeline events when the client reconnects or dev mode
-- replays effects. Keep the first event per logical slot.

with ranked as (
  select
    id,
    row_number() over (
      partition by run_id, event_type, coalesce(stage_key, '')
      order by id asc
    ) as rn
  from public.run_events
)
delete from public.run_events
where id in (
  select id
  from ranked
  where rn > 1
);

create unique index if not exists run_events_unique_run_event
  on public.run_events (run_id, event_type)
  where stage_key is null;

create unique index if not exists run_events_unique_stage_event
  on public.run_events (run_id, event_type, stage_key)
  where stage_key is not null;
