-- Async Copilot — demo completed run for the golden path.
-- Creates one finished run + all 6 stages + response pack on the
-- payments-dispute golden sample so the Runs List / Completed screens
-- have something to show out of the box.
-- Idempotent : keyed by `cases.case_ref = 'CASE-8924'`.

do $$
declare
  v_sample_id uuid;
  v_workspace_id uuid;
  v_case_id uuid;
  v_run_id uuid;
  v_now timestamptz := now();
begin
  -- Look up the golden sample
  select id into v_sample_id from public.samples where slug = 'payments-dispute-duplicate-charge';
  if v_sample_id is null then
    raise exception 'Golden sample not found. Seed 001 must run first.';
  end if;

  select id into v_workspace_id from public.workspaces where slug = 'demo';
  if v_workspace_id is null then
    raise exception 'Demo workspace not found. Migration 005 must run first.';
  end if;

  -- Upsert the demo case (stable case_ref so reruns are idempotent)
  insert into public.cases (
    workspace_id,
    case_ref, title, body, source, sample_id,
    customer_name, customer_account, customer_plan
  )
  values (
    v_workspace_id,
    'CASE-8924',
    'Payments dispute — duplicate charge / delayed refund',
    E'Hi Support,\n\nI just checked my statement and Stripe definitely authorized $1,200 twice on Nov 12 for my Pro Annual renewal. I only see one invoice (INV-9823) in my account. Can you please look into this immediately and reverse the duplicate charge?\n\nThis is affecting my cash flow this month and I need resolution today.\n\nBest,\nJane Doe\nAcme Corp',
    'sample',
    v_sample_id,
    'Jane Doe',
    'Acme Corp',
    'Pro Annual'
  )
  on conflict (case_ref) do update set
    title = excluded.title,
    body = excluded.body,
    customer_name = excluded.customer_name,
    customer_account = excluded.customer_account,
    customer_plan = excluded.customer_plan,
    sample_id = excluded.sample_id
  returning id into v_case_id;

  -- Wipe any prior demo run for this case (keeps seeding idempotent)
  delete from public.runs where case_id = v_case_id;

  -- Fresh completed run
  insert into public.runs (
    workspace_id, case_id, state, confidence, urgency,
    started_at, completed_at, last_advanced_at,
    advance_cursor, total_stages
  )
  values (
    v_workspace_id,
    v_case_id,
    'completed',
    34,
    'high',
    v_now - interval '5 minutes',
    v_now - interval '4 minutes 12 seconds',
    v_now - interval '4 minutes 12 seconds',
    6,
    6
  )
  returning id into v_run_id;

  -- Six stages with timing-correct output blobs
  insert into public.run_stages (run_id, stage_order, stage_key, stage_label, state, duration_ms, output, started_at, completed_at)
  values
    (v_run_id, 1, 'ingest',    'Ingest Case',             'completed',  14,
      '{"parsed":"email-thread","attachments":0,"tokens":112}'::jsonb,
      v_now - interval '5 minutes', v_now - interval '5 minutes' + interval '14 ms'),
    (v_run_id, 2, 'normalize', 'Normalize Facts',          'completed',  42,
      '{"customer_id":"CUST-2041","invoice":"INV-9823","amount":1200,"authorizations_seen":2}'::jsonb,
      v_now - interval '4 minutes 59 seconds', v_now - interval '4 minutes 59 seconds' + interval '42 ms'),
    (v_run_id, 3, 'classify',  'Classify Issue & Urgency', 'completed', 128,
      '{"intent":"duplicate_charge","urgency":"high","reason":"checkout_blocked_and_cash_flow_impact"}'::jsonb,
      v_now - interval '4 minutes 58 seconds', v_now - interval '4 minutes 58 seconds' + interval '128 ms'),
    (v_run_id, 4, 'query',     'Query Internal State',     'completed', 312,
      '{"stripe_authorizations":2,"internal_invoices":1,"ledger_mismatch":true,"warning":"stripe_says_2_charges_but_db_has_1_invoice"}'::jsonb,
      v_now - interval '4 minutes 56 seconds', v_now - interval '4 minutes 56 seconds' + interval '312 ms'),
    (v_run_id, 5, 'policy',    'Check Policy & Risk',      'completed',  98,
      '{"policy":"requires_ledger_sync_before_refund","auto_refund_allowed":false,"route":"Tier-2-Finance"}'::jsonb,
      v_now - interval '4 minutes 54 seconds', v_now - interval '4 minutes 54 seconds' + interval '98 ms'),
    (v_run_id, 6, 'draft',     'Draft Response Pack',      'completed', 244,
      '{"confidence":34,"escalation_required":true}'::jsonb,
      v_now - interval '4 minutes 53 seconds', v_now - interval '4 minutes 53 seconds' + interval '244 ms');

  -- Response pack
  insert into public.response_packs (
    run_id, confidence, recommendation, internal_summary, draft_reply,
    citations, staged_actions, escalation_queue
  )
  values (
    v_run_id,
    34,
    'Route to Tier-2-Finance queue. Do not auto-reply until ledger mismatch is resolved by human operator.',
    E'Customer reporting duplicate $1,200 charge on Pro Annual renewal (Nov 12). Confirmed via Stripe API that two authorizations exist. However, internal DB only shows one invoice (INV-9823). This requires manual refund and sync.',
    E'Hi Jane,\n\nThank you for flagging this charge. I''m sorry for the confusion here. I''ve looked into your account and I can confirm that we see two $1,200 authorizations on Nov 12, but only one invoice on our side (INV-9823). Our finance team is reviewing the ledger mismatch right now and will issue a refund for the duplicate charge within 24 hours.\n\nI''ll follow up personally with confirmation once the refund has been processed.\n\nBest regards,\nAsync Copilot (staged reply, awaiting operator approval)',
    '[
      {"source":"Stripe API","id":"ch_3P8a1b…","note":"Authorization #1 ($1200) on 2025-11-12T09:14Z"},
      {"source":"Stripe API","id":"ch_3P8a2c…","note":"Authorization #2 ($1200) on 2025-11-12T09:14Z"},
      {"source":"Internal invoice","id":"INV-9823","note":"Only one invoice issued, PAID status"}
    ]'::jsonb,
    '[
      {"label":"Issue Stripe Refund ($1,200)","intent":"stripe.refund","status":"queued","requires_approval":true},
      {"label":"Reconcile ledger (INV-9823)","intent":"internal.ledger.reconcile","status":"queued","requires_approval":true},
      {"label":"Notify Jane with follow-up SLA","intent":"email.send","status":"queued","requires_approval":true},
      {"label":"Send escalation summary to Slack","intent":"slack.notify","status":"queued","requires_approval":true,"detail":"Dispatch a Tier-2 summary to Slack after human approval.","target":"Slack webhook","last_attempt_at":null}
    ]'::jsonb,
    'Tier-2-Finance'
  );

  insert into public.run_events (workspace_id, case_id, run_id, event_type, actor_type, created_at)
  values
    (v_workspace_id, v_case_id, v_run_id, 'run.created', 'system', v_now - interval '5 minutes 5 seconds'),
    (v_workspace_id, v_case_id, v_run_id, 'run.started', 'system', v_now - interval '5 minutes');

  insert into public.run_events (workspace_id, case_id, run_id, event_type, actor_type, stage_key, payload, created_at)
  values
    (v_workspace_id, v_case_id, v_run_id, 'stage.started', 'system', 'ingest',    '{"stage_order":1,"stage_label":"Ingest Case"}'::jsonb,             v_now - interval '5 minutes'),
    (v_workspace_id, v_case_id, v_run_id, 'stage.completed', 'system', 'ingest',  '{"stage_order":1,"stage_label":"Ingest Case","duration_ms":14}'::jsonb,             v_now - interval '5 minutes' + interval '14 ms'),
    (v_workspace_id, v_case_id, v_run_id, 'stage.started', 'system', 'normalize', '{"stage_order":2,"stage_label":"Normalize Facts"}'::jsonb,         v_now - interval '4 minutes 59 seconds'),
    (v_workspace_id, v_case_id, v_run_id, 'stage.completed', 'system', 'normalize','{"stage_order":2,"stage_label":"Normalize Facts","duration_ms":42}'::jsonb,         v_now - interval '4 minutes 59 seconds' + interval '42 ms'),
    (v_workspace_id, v_case_id, v_run_id, 'stage.started', 'system', 'classify',  '{"stage_order":3,"stage_label":"Classify Issue & Urgency"}'::jsonb, v_now - interval '4 minutes 58 seconds'),
    (v_workspace_id, v_case_id, v_run_id, 'stage.completed', 'system', 'classify','{"stage_order":3,"stage_label":"Classify Issue & Urgency","duration_ms":128}'::jsonb, v_now - interval '4 minutes 58 seconds' + interval '128 ms'),
    (v_workspace_id, v_case_id, v_run_id, 'stage.started', 'system', 'query',     '{"stage_order":4,"stage_label":"Query Internal State"}'::jsonb,      v_now - interval '4 minutes 56 seconds'),
    (v_workspace_id, v_case_id, v_run_id, 'stage.completed', 'system', 'query',   '{"stage_order":4,"stage_label":"Query Internal State","duration_ms":312}'::jsonb,      v_now - interval '4 minutes 56 seconds' + interval '312 ms'),
    (v_workspace_id, v_case_id, v_run_id, 'stage.started', 'system', 'policy',    '{"stage_order":5,"stage_label":"Check Policy & Risk"}'::jsonb,       v_now - interval '4 minutes 54 seconds'),
    (v_workspace_id, v_case_id, v_run_id, 'stage.completed', 'system', 'policy',  '{"stage_order":5,"stage_label":"Check Policy & Risk","duration_ms":98}'::jsonb,       v_now - interval '4 minutes 54 seconds' + interval '98 ms'),
    (v_workspace_id, v_case_id, v_run_id, 'stage.started', 'system', 'draft',     '{"stage_order":6,"stage_label":"Draft Response Pack"}'::jsonb,       v_now - interval '4 minutes 53 seconds'),
    (v_workspace_id, v_case_id, v_run_id, 'stage.completed', 'system', 'draft',   '{"stage_order":6,"stage_label":"Draft Response Pack","duration_ms":244}'::jsonb,       v_now - interval '4 minutes 53 seconds' + interval '244 ms'),
    (v_workspace_id, v_case_id, v_run_id, 'response_pack.created', 'system', null, '{"confidence":34}'::jsonb,                                              v_now - interval '4 minutes 12 seconds'),
    (v_workspace_id, v_case_id, v_run_id, 'run.completed', 'system', null,        '{"state":"completed","confidence":34,"urgency":"high"}'::jsonb,  v_now - interval '4 minutes 12 seconds');

  raise notice 'Seeded golden run: run_id=%, case_id=%', v_run_id, v_case_id;
end $$;
