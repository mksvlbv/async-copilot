-- Async Copilot — sample library seeds
-- Idempotent: uses `on conflict (slug) do update`.

-- =====================================================================
-- Golden path : Payments Dispute (the demo hero scenario)
-- =====================================================================
insert into public.samples (slug, name, summary, body, urgency, is_golden, expected_confidence, expected_stages, tags)
values (
  'payments-dispute-duplicate-charge',
  'Payments Dispute — Duplicate Charge',
  'Stripe duplicate-charge claim on Pro Annual renewal. Requires ledger reconciliation.',
  E'Hi Support,\n\nI just checked my statement and Stripe definitely authorized $1,200 twice on Nov 12 for my Pro Annual renewal. I only see one invoice (INV-9823) in my account. Can you please look into this immediately and reverse the duplicate charge?\n\nThis is affecting my cash flow this month and I need resolution today.\n\nBest,\nJane Doe\nAcme Corp',
  'high',
  true,
  34,
  '[
    { "key": "ingest",    "label": "Ingest Case",           "duration_ms": 14 },
    { "key": "normalize", "label": "Normalize Facts",       "duration_ms": 42 },
    { "key": "classify",  "label": "Classify Issue & Urgency", "duration_ms": 128 },
    { "key": "query",     "label": "Query Internal State",  "duration_ms": 312 },
    { "key": "policy",    "label": "Check Policy & Risk",   "duration_ms": 98 },
    { "key": "draft",     "label": "Draft Response Pack",   "duration_ms": 244 }
  ]'::jsonb,
  array['payments', 'billing', 'stripe', 'escalation', 'golden']
)
on conflict (slug) do update set
  name = excluded.name,
  summary = excluded.summary,
  body = excluded.body,
  urgency = excluded.urgency,
  is_golden = excluded.is_golden,
  expected_confidence = excluded.expected_confidence,
  expected_stages = excluded.expected_stages,
  tags = excluded.tags;

-- =====================================================================
-- Alt 1 : API Timeout — clean high-confidence run
-- =====================================================================
insert into public.samples (slug, name, summary, body, urgency, is_golden, expected_confidence, expected_stages, tags)
values (
  'api-timeout-v2-orders',
  'API Timeout on /v2/orders',
  'Persistent 504 gateway timeouts on checkout endpoint during active DB migration incident.',
  E'Hi Support,\n\nWe are seeing persistent 504 timeouts when calling the /v2/orders endpoint since 10:00 AM PST. This is blocking our checkout flow and we are losing revenue every minute.\n\nRequest ID examples: req_8a9f2b, req_7c1d4e, req_3f8a1b.\n\nPlease escalate — this is production-down for us.\n\nThanks,\nMarcus Lee\nNova Labs',
  'high',
  false,
  92,
  '[
    { "key": "ingest",    "label": "Ingest Case",           "duration_ms": 12 },
    { "key": "normalize", "label": "Normalize Facts",       "duration_ms": 38 },
    { "key": "classify",  "label": "Classify Issue & Urgency", "duration_ms": 104 },
    { "key": "query",     "label": "Query Internal State",  "duration_ms": 286 },
    { "key": "policy",    "label": "Check Policy & Risk",   "duration_ms": 72 },
    { "key": "draft",     "label": "Draft Response Pack",   "duration_ms": 198 }
  ]'::jsonb,
  array['api', 'outage', 'infra', 'p1']
);

-- Idempotent upsert for Alt 1
update public.samples set
  name = 'API Timeout on /v2/orders',
  summary = 'Persistent 504 gateway timeouts on checkout endpoint during active DB migration incident.',
  urgency = 'high',
  expected_confidence = 92,
  tags = array['api', 'outage', 'infra', 'p1']
where slug = 'api-timeout-v2-orders';

-- =====================================================================
-- Alt 2 : Feature Request — low urgency, long-tail
-- =====================================================================
insert into public.samples (slug, name, summary, body, urgency, is_golden, expected_confidence, expected_stages, tags)
values (
  'feature-request-bulk-export',
  'Feature Request — Bulk CSV Export',
  'Customer asks for multi-select bulk export across workspaces. Clear routing path.',
  E'Hey team,\n\nWould it be possible to add a bulk CSV export across all my workspaces at once? Right now I have to export each workspace separately which takes about an hour for our 40 projects.\n\nNot urgent, but would really help our monthly reporting.\n\nCheers,\nPriya Shah\nGreyBox',
  'low',
  false,
  88,
  '[
    { "key": "ingest",    "label": "Ingest Case",           "duration_ms": 11 },
    { "key": "normalize", "label": "Normalize Facts",       "duration_ms": 31 },
    { "key": "classify",  "label": "Classify Issue & Urgency", "duration_ms": 79 },
    { "key": "query",     "label": "Query Internal State",  "duration_ms": 144 },
    { "key": "policy",    "label": "Check Policy & Risk",   "duration_ms": 48 },
    { "key": "draft",     "label": "Draft Response Pack",   "duration_ms": 172 }
  ]'::jsonb,
  array['feature', 'product', 'routing']
)
on conflict (slug) do update set
  name = excluded.name,
  summary = excluded.summary,
  body = excluded.body,
  urgency = excluded.urgency,
  expected_confidence = excluded.expected_confidence,
  expected_stages = excluded.expected_stages,
  tags = excluded.tags;

-- =====================================================================
-- Alt 3 : Login Loop — medium confidence with ambiguity
-- =====================================================================
insert into public.samples (slug, name, summary, body, urgency, is_golden, expected_confidence, expected_stages, tags)
values (
  'login-loop-sso-saml',
  'SSO Login Loop After Password Reset',
  'User bounced between login and SSO callback. Recent password change + IdP metadata change — ambiguous cause.',
  E'Hi,\n\nI cannot log in. After I reset my password yesterday, I keep getting redirected in a loop between your login page and our Okta SSO. Browser is Chrome 130 on macOS, already tried incognito + cleared cookies.\n\nMy email: kai@steppe.io, account: steppe-prod.\n\nNeed this today — I have a board meeting at 3pm.\n\nThanks,\nKai Nurlan',
  'medium',
  false,
  58,
  '[
    { "key": "ingest",    "label": "Ingest Case",           "duration_ms": 15 },
    { "key": "normalize", "label": "Normalize Facts",       "duration_ms": 44 },
    { "key": "classify",  "label": "Classify Issue & Urgency", "duration_ms": 116 },
    { "key": "query",     "label": "Query Internal State",  "duration_ms": 298 },
    { "key": "policy",    "label": "Check Policy & Risk",   "duration_ms": 88 },
    { "key": "draft",     "label": "Draft Response Pack",   "duration_ms": 221 }
  ]'::jsonb,
  array['auth', 'sso', 'saml', 'ambiguous']
)
on conflict (slug) do update set
  name = excluded.name,
  summary = excluded.summary,
  body = excluded.body,
  urgency = excluded.urgency,
  expected_confidence = excluded.expected_confidence,
  expected_stages = excluded.expected_stages,
  tags = excluded.tags;

-- =====================================================================
-- Alt 4 : Security Concern — force escalation regardless of confidence
-- =====================================================================
insert into public.samples (slug, name, summary, body, urgency, is_golden, expected_confidence, expected_stages, tags)
values (
  'security-suspicious-api-calls',
  'Suspicious API Calls from Unknown IP',
  'Customer reports unauthorized-looking activity on API key. Policy requires Tier-2 Security routing.',
  E'Hello,\n\nWe noticed a spike of ~4,800 API calls in the last 30 minutes from an IP we do not recognize (185.243.x.x, geo: Romania). Our team only operates from US and Ireland.\n\nPlease freeze the API key immediately and let us know what data might have been exposed. Key ID: sk_live_abc123...d891.\n\nThis is security-sensitive.\n\nRegards,\nAndrea Petrova\nFortress Analytics',
  'high',
  false,
  76,
  '[
    { "key": "ingest",    "label": "Ingest Case",           "duration_ms": 13 },
    { "key": "normalize", "label": "Normalize Facts",       "duration_ms": 41 },
    { "key": "classify",  "label": "Classify Issue & Urgency", "duration_ms": 123 },
    { "key": "query",     "label": "Query Internal State",  "duration_ms": 267 },
    { "key": "policy",    "label": "Check Policy & Risk",   "duration_ms": 144 },
    { "key": "draft",     "label": "Draft Response Pack",   "duration_ms": 211 }
  ]'::jsonb,
  array['security', 'api-key', 'escalation', 'tier-2']
)
on conflict (slug) do update set
  name = excluded.name,
  summary = excluded.summary,
  body = excluded.body,
  urgency = excluded.urgency,
  expected_confidence = excluded.expected_confidence,
  expected_stages = excluded.expected_stages,
  tags = excluded.tags;
