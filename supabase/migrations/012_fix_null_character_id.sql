-- Migration 012: Fix NULL character_id in historical data
-- Strategy: Create default character for each user and assign to NULL records

-- Step 1: Create default characters for users with NULL character_id records
INSERT INTO user_characters (owner_id, name, personality, is_active)
SELECT DISTINCT s.user_id, '默认角色', '系统默认角色', true
FROM sessions s
WHERE s.character_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_characters uc
    WHERE uc.owner_id = s.user_id AND uc.name = '默认角色'
  )
ON CONFLICT DO NOTHING;

-- Step 2: Update sessions with NULL character_id
UPDATE sessions s
SET character_id = (
  SELECT id FROM user_characters
  WHERE owner_id = s.user_id AND name = '默认角色'
  LIMIT 1
)
WHERE character_id IS NULL;

-- Step 3: Update memories with NULL character_id
UPDATE memories m
SET character_id = (
  SELECT id FROM user_characters
  WHERE owner_id = m.user_id AND name = '默认角色'
  LIMIT 1
)
WHERE character_id IS NULL;

-- Step 4: Update user_profiles_per_persona with NULL character_id
UPDATE user_profiles_per_persona upp
SET character_id = (
  SELECT id FROM user_characters
  WHERE owner_id = upp.user_id AND name = '默认角色'
  LIMIT 1
)
WHERE character_id IS NULL;

-- Step 5: Verify no NULL character_id remains
DO $$
DECLARE
  null_sessions_count INT;
  null_memories_count INT;
  null_profiles_count INT;
BEGIN
  SELECT COUNT(*) INTO null_sessions_count FROM sessions WHERE character_id IS NULL;
  SELECT COUNT(*) INTO null_memories_count FROM memories WHERE character_id IS NULL;
  SELECT COUNT(*) INTO null_profiles_count FROM user_profiles_per_persona WHERE character_id IS NULL;

  IF null_sessions_count > 0 OR null_memories_count > 0 OR null_profiles_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: NULL character_id still exists (sessions: %, memories: %, profiles: %)',
      null_sessions_count, null_memories_count, null_profiles_count;
  END IF;

  RAISE NOTICE 'Migration 012 completed successfully. All NULL character_id records have been fixed.';
END $$;
