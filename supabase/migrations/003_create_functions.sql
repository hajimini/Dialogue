-- ============================================================
-- Phase 1: 向量搜索函数（match_memories）
-- ============================================================

create or replace function public.match_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_persona_id uuid,
  match_count int default 5,
  match_threshold float default 0.7
)
returns table (
  id uuid,
  content text,
  memory_type text,
  importance float,
  similarity float,
  created_at timestamptz
)
language sql stable
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
    and m.persona_id = match_persona_id
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;

