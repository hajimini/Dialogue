-- Migration 010: Fix match_memories return type mismatch
-- The memories.importance column is float, so the RPC must return float as well.

drop function if exists public.match_memories(vector(1536), uuid, uuid, uuid, int, float);

create or replace function public.match_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_persona_id uuid,
  match_character_id uuid,
  match_count int default 10,
  match_threshold float default 0.1
)
returns table (
  id uuid,
  content text,
  memory_type text,
  importance float,
  similarity float,
  created_at timestamptz
)
language sql
stable
as $$
  select
    m.id,
    m.content,
    m.memory_type,
    m.importance,
    1 - (m.embedding <=> query_embedding) as similarity,
    m.created_at
  from public.memories m
  where m.user_id = match_user_id
    and (match_persona_id is null or m.persona_id = match_persona_id)
    and m.character_id = match_character_id
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
