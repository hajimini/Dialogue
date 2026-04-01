CREATE TABLE IF NOT EXISTS memory_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('accurate', 'inaccurate')),
  feedback_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_feedback_memory_id ON memory_feedback(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_feedback_user_id ON memory_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_feedback_created_at ON memory_feedback(created_at DESC);

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS feedback_count_accurate INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback_count_inaccurate INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retrieval_count INTEGER NOT NULL DEFAULT 0;

DO $
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memory_feedback'
      AND column_name = 'user_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE memory_feedback
      ALTER COLUMN user_id TYPE TEXT;
  END IF;
END $;

CREATE INDEX IF NOT EXISTS idx_memories_feedback_inaccurate
  ON memories(feedback_count_inaccurate DESC);

CREATE TABLE IF NOT EXISTS memory_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config JSONB NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_config_history_changed_at
  ON memory_config_history(changed_at DESC);

CREATE TABLE IF NOT EXISTS memory_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operation TEXT NOT NULL,
  user_id TEXT NOT NULL,
  persona_id TEXT,
  memory_id UUID,
  duration INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_memory_operation_logs_timestamp
  ON memory_operation_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_memory_operation_logs_operation
  ON memory_operation_logs(operation);
CREATE INDEX IF NOT EXISTS idx_memory_operation_logs_user_id
  ON memory_operation_logs(user_id);

GRANT SELECT, DELETE ON TABLE memories TO authenticated;
GRANT SELECT, INSERT ON TABLE memory_feedback TO authenticated;
GRANT SELECT ON TABLE memory_feedback TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE memories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE memory_config_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE memory_operation_logs TO service_role;

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_feedback ENABLE ROW LEVEL SECURITY;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'memories'
      AND policyname = 'memories_select_own'
  ) THEN
    CREATE POLICY memories_select_own
      ON memories
      FOR SELECT
      USING (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'memories'
      AND policyname = 'memories_delete_own'
  ) THEN
    CREATE POLICY memories_delete_own
      ON memories
      FOR DELETE
      USING (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'memory_feedback'
      AND policyname = 'memory_feedback_insert_own'
  ) THEN
    CREATE POLICY memory_feedback_insert_own
      ON memory_feedback
      FOR INSERT
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'memory_feedback'
      AND policyname = 'memory_feedback_select_own'
  ) THEN
    CREATE POLICY memory_feedback_select_own
      ON memory_feedback
      FOR SELECT
      USING (user_id = auth.uid()::text);
  END IF;
END $;
