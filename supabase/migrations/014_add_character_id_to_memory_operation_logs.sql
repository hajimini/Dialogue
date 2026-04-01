-- Add character_id column to memory_operation_logs table
-- This enables character-level filtering in the admin memory performance dashboard

ALTER TABLE memory_operation_logs
  ADD COLUMN IF NOT EXISTS character_id TEXT;

-- Add index for character_id filtering
CREATE INDEX IF NOT EXISTS idx_memory_operation_logs_character_id
  ON memory_operation_logs(character_id);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_memory_operation_logs_character_operation
  ON memory_operation_logs(character_id, operation, timestamp DESC);
