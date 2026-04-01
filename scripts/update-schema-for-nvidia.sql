-- Update memories table to support 1024-dimension vectors (NVIDIA)
-- This script modifies the existing schema to support both 1536 (OpenAI) and 1024 (NVIDIA) dimensions

-- Drop the existing vector index (it's tied to the column type)
DROP INDEX IF EXISTS idx_memories_embedding;

-- Alter the embedding column to support 1024 dimensions
-- Note: This will require re-generating embeddings for existing data
ALTER TABLE memories 
ALTER COLUMN embedding TYPE VECTOR(1024);

-- Recreate the vector similarity search index for 1024 dimensions
CREATE INDEX idx_memories_embedding ON memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Note: After running this script, you need to:
-- 1. Re-generate embeddings for all existing memories using NVIDIA API
-- 2. Or run the migration script again with EMBEDDING_PROVIDER=nvidia
