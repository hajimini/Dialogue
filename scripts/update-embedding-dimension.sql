-- Update the embedding column to support 1024 dimensions (NVIDIA NV-Embed-QA)
-- This is needed because the current schema expects 1536 dimensions (OpenAI)

-- Drop the existing index
DROP INDEX IF EXISTS idx_memories_embedding;

-- Alter the column to use 1024 dimensions
ALTER TABLE memories 
ALTER COLUMN embedding TYPE VECTOR(1024);

-- Recreate the index with the new dimension
CREATE INDEX idx_memories_embedding ON memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Verify the change
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'memories' AND column_name = 'embedding';
