-- Migration 008: Memory Character Isolation
-- Add character_id parameter to match_memories RPC function for complete memory isolation

-- Drop existing function
drop function if exists match_memories(vector(1536), uuid, uuid, int, float);

-- Recreate with character_id parameter
create or replace function match_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_persona_id uuid,
  match_character_id uuid,  -- New parameter for character isolation
  match_count int default 10,
  match_threshold float default 0.1
)
returns table (
  id uuid,
  content text,
  memory_type text,
  importance int,
  similarity float,
  created_at timestamptz
)
language plpgsql
as $$
begin
  return query
  select
    m.id,
    m.content,
    m.memory_type,
    m.importance,
    1 - (m.embedding <=> query_embedding) as similarity,
    m.created_at
  from memories m
  where m.user_id = match_user_id
    and m.persona_id = match_persona_id
    and m.character_id = match_character_id  -- Filter by character_id
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Add comment
comment on function match_memories is 'Search memories with character isolation - filters by user_id, persona_id, and character_id';
