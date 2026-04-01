-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create memories table
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('user_fact', 'persona_fact', 'shared_event', 'relationship', 'session_summary')),
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- pgvector extension
  importance FLOAT NOT NULL DEFAULT 0.5,
  source_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for memories table
CREATE INDEX IF NOT EXISTS idx_memories_user_persona ON memories (user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories (memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories (updated_at DESC);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create user_profiles_per_persona table (if not exists)
CREATE TABLE IF NOT EXISTS user_profiles_per_persona (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  profile_data JSONB NOT NULL DEFAULT '{
    "summary": "",
    "facts": [],
    "preferences": [],
    "relationship_notes": [],
    "recent_topics": [],
    "anchors": []
  }'::jsonb,
  relationship_stage TEXT NOT NULL DEFAULT 'new' CHECK (relationship_stage IN ('new', 'warming', 'close')),
  total_messages INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (user_id, persona_id)
);

-- Create sessions table (if not exists)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  topics TEXT[],
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_persona ON sessions (user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions (created_at DESC);
