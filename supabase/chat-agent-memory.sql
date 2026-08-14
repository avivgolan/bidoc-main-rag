-- Persistent, user-isolated conversational memory for Main and Lite agents.
-- Embeddings use openai/text-embedding-3-large (3072 dimensions).

create extension if not exists vector with schema public;

create table if not exists public.chat_session_memory (
  session_id text primary key,
  user_id text null,
  summary jsonb not null default '{}'::jsonb,
  turn_count integer not null default 0 check (turn_count >= 0),
  summary_version integer not null default 1 check (summary_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_session_memory_user_updated_idx
  on public.chat_session_memory (user_id, updated_at desc)
  where user_id is not null;

create table if not exists public.chat_memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  memory_type text not null default 'fact'
    check (memory_type in ('fact', 'preference', 'profile', 'instruction', 'relationship', 'correction')),
  canonical_key text not null,
  content text not null check (char_length(content) between 1 and 2000),
  source text not null default 'automatic'
    check (source in ('explicit', 'automatic', 'correction')),
  source_session_id text null,
  source_message_id bigint null,
  confidence real not null default 1 check (confidence between 0 and 1),
  importance real not null default 0.5 check (importance between 0 and 1),
  embedding vector(3072) null,
  embedding_model text not null default 'openai/text-embedding-3-large',
  valid_from timestamptz not null default now(),
  valid_to timestamptz null,
  expires_at timestamptz null,
  superseded_by uuid null references public.chat_memory_items(id) on delete set null,
  access_count integer not null default 0 check (access_count >= 0),
  last_accessed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists chat_memory_items_active_key_idx
  on public.chat_memory_items (user_id, canonical_key)
  where valid_to is null;

create index if not exists chat_memory_items_user_valid_idx
  on public.chat_memory_items (user_id, valid_to, updated_at desc);

create index if not exists chat_memory_items_expiry_idx
  on public.chat_memory_items (expires_at)
  where expires_at is not null and valid_to is null;

alter table public.chat_session_memory enable row level security;
alter table public.chat_memory_items enable row level security;

revoke all on table public.chat_session_memory from public, anon, authenticated;
revoke all on table public.chat_memory_items from public, anon, authenticated;
grant select, insert, update, delete on table public.chat_session_memory to service_role;
grant select, insert, update, delete on table public.chat_memory_items to service_role;

create or replace function public.set_chat_memory_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_chat_memory_updated_at() from public, anon, authenticated;
grant execute on function public.set_chat_memory_updated_at() to service_role;

drop trigger if exists set_chat_session_memory_updated_at on public.chat_session_memory;
create trigger set_chat_session_memory_updated_at
before update on public.chat_session_memory
for each row execute function public.set_chat_memory_updated_at();

drop trigger if exists set_chat_memory_items_updated_at on public.chat_memory_items;
create trigger set_chat_memory_items_updated_at
before update on public.chat_memory_items
for each row execute function public.set_chat_memory_updated_at();

create or replace function public.match_chat_memory(
  p_user_id text,
  p_query_embedding vector(3072),
  p_match_count integer default 6,
  p_similarity_threshold real default 0.72,
  p_semantic_weight real default 0.70,
  p_recency_weight real default 0.15,
  p_importance_weight real default 0.15
)
returns table (
  id uuid,
  memory_type text,
  canonical_key text,
  content text,
  source text,
  confidence real,
  importance real,
  similarity double precision,
  recency_score double precision,
  score double precision,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with ranked as (
    select
      item.id,
      item.memory_type,
      item.canonical_key,
      item.content,
      item.source,
      item.confidence,
      item.importance,
      1 - (item.embedding <=> p_query_embedding) as similarity,
      1 / (1 + extract(epoch from (now() - item.updated_at)) / 86400 / 30) as recency_score,
      item.updated_at
    from public.chat_memory_items item
    where item.user_id = p_user_id
      and item.valid_to is null
      and (item.expires_at is null or item.expires_at > now())
      and item.embedding is not null
  )
  select
    ranked.id,
    ranked.memory_type,
    ranked.canonical_key,
    ranked.content,
    ranked.source,
    ranked.confidence,
    ranked.importance,
    ranked.similarity,
    ranked.recency_score,
    (ranked.similarity * p_semantic_weight
      + ranked.recency_score * p_recency_weight
      + ranked.importance * p_importance_weight)::double precision as score,
    ranked.updated_at
  from ranked
  where ranked.similarity >= p_similarity_threshold
  order by score desc, ranked.updated_at desc
  limit greatest(1, least(coalesce(p_match_count, 6), 50));
$$;

revoke all on function public.match_chat_memory(text, vector, integer, real, real, real, real)
  from public, anon, authenticated;
grant execute on function public.match_chat_memory(text, vector, integer, real, real, real, real)
  to service_role;

update public.agent_settings
set data = jsonb_set(
  coalesce(data, '{}'::jsonb),
  '{memory}',
  '{
    "enabled": true,
    "crossSessionEnabled": true,
    "writePolicy": "hybrid",
    "autoLearnMinConfidence": 0.85,
    "summaryRefreshEveryTurns": 4,
    "retentionDays": 365,
    "maxItemsPerUser": 1000,
    "routingRecentTurns": 4,
    "routingTokenBudget": 1200,
    "agents": {
      "main": {
        "enabled": true,
        "recentTurns": 6,
        "contextTokenBudget": 3000,
        "useSessionSummary": true,
        "useLongTermMemory": true,
        "semanticTopK": 6,
        "similarityThreshold": 0.72,
        "semanticWeight": 0.70,
        "recencyWeight": 0.15,
        "importanceWeight": 0.15
      },
      "lite": {
        "enabled": true,
        "recentTurns": 8,
        "contextTokenBudget": 4000,
        "useSessionSummary": true,
        "useLongTermMemory": true,
        "semanticTopK": 4,
        "similarityThreshold": 0.70,
        "semanticWeight": 0.65,
        "recencyWeight": 0.20,
        "importanceWeight": 0.15
      }
    }
  }'::jsonb,
  true
), updated_at = now()
where id = 'default' and not (coalesce(data, '{}'::jsonb) ? 'memory');
