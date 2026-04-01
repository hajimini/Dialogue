-- ============================================================
-- Fix match_memories function to support character_id filtering
-- and preserve retrieval metadata needed by app-side ranking.
-- ============================================================

-- Drop the old function
DROP FUNCTION IF EXISTS public.match_memories(vector(1536), uuid, uuid, uuid, int, float);

-- Recreate with character_id parameter
CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding vector(1536),
  match_user_id uuid,
  match_persona_id uuid,
  match_character_id uuid DEFAULT NULL,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  content text,
  memory_type text,
  importance float,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz,
  source_session_id uuid
)
LANGUAGE sql STABLE
AS $$
  SELECT
    m.id,
    m.content,
    m.memory_type,
    m.importance,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.created_at,
    m.updated_at,
    m.source_session_id
  FROM public.memories m
  WHERE m.user_id = match_user_id
    AND m.persona_id = match_persona_id
    AND (match_character_id IS NULL OR m.character_id = match_character_id)
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC, m.updated_at DESC, m.created_at DESC
  LIMIT match_count;
$$;
