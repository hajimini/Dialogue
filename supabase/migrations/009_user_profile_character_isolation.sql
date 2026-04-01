-- Migration 009: User Profile Character Isolation
-- Add character_id to user_profiles_per_persona for complete isolation

-- Add character_id column
alter table public.user_profiles_per_persona
  add column if not exists character_id uuid references public.user_characters(id) on delete cascade;

-- Create index for character-based queries
create index if not exists idx_user_profiles_character
  on public.user_profiles_per_persona(user_id, persona_id, character_id);

-- Drop old unique constraint
alter table public.user_profiles_per_persona
  drop constraint if exists user_profiles_per_persona_user_id_persona_id_key;

-- Add new unique constraint with character_id
alter table public.user_profiles_per_persona
  add constraint user_profiles_per_persona_user_persona_character_key
  unique (user_id, persona_id, character_id);

-- Add comment
comment on column user_profiles_per_persona.character_id is 'Character ID for profile isolation - each user+persona+character combination has independent profile';
