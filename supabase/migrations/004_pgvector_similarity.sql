-- Enable pgvector extension (free on Supabase)
create extension if not exists vector with schema extensions;

-- Enable pg_trgm for trigram similarity search
create extension if not exists pg_trgm with schema extensions;

-- Add full-text search vector column to cases
alter table cases add column if not exists fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored;

-- GIN index for fast full-text search
create index if not exists idx_cases_fts on cases using gin (fts);

-- GIN index for trigram similarity on title
create index if not exists idx_cases_title_trgm on cases using gin (title extensions.gin_trgm_ops);

-- Optional: embedding column for future use with real embedding models
-- 384 dimensions = all-MiniLM-L6-v2 / text-embedding-3-small (compact)
alter table cases add column if not exists embedding extensions.vector(384);

-- Similarity search function: combines full-text rank + trigram similarity
create or replace function search_similar_cases(
  query_title text,
  query_body text,
  exclude_case_id uuid default null,
  match_limit int default 5
)
returns table (
  id uuid,
  case_ref text,
  title text,
  body text,
  source text,
  customer_name text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.case_ref,
    c.title,
    c.body,
    c.source::text,
    c.customer_name,
    c.created_at,
    (
      -- Full-text rank (0–1) weighted 60%
      coalesce(ts_rank(c.fts, plainto_tsquery('english', query_title || ' ' || query_body)), 0) * 0.6
      +
      -- Trigram similarity on title (0–1) weighted 40%
      coalesce(extensions.similarity(c.title, query_title), 0) * 0.4
    ) as similarity
  from cases c
  where
    (exclude_case_id is null or c.id != exclude_case_id)
    and (
      c.fts @@ plainto_tsquery('english', query_title || ' ' || query_body)
      or extensions.similarity(c.title, query_title) > 0.1
    )
  order by similarity desc
  limit match_limit;
$$;
