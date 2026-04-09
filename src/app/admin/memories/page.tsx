import { listAppUsers } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";
import type { Persona, UserCharacterRecord } from "@/lib/supabase/types";
import MemoriesClient from "./MemoriesClient";

type MemoryScopeOption = {
  userId: string;
  userNickname: string | null;
  userEmail: string | null;
  personaId: string;
  personaName: string;
  personaOccupation: string | null;
  personaCity: string | null;
  personaIsActive: boolean;
  characterId: string;
  characterName: string;
  characterIsActive: boolean;
  memoryCount: number;
  sessionCount: number;
  lastActivityAt: string | null;
};

export default async function AdminMemoriesPage() {
  const [users, personas, characters, scopes] = await Promise.all([
    listAppUsers(),
    queryPostgres<Pick<Persona, "id" | "name" | "occupation" | "city">>(
      `
        select id, name, occupation, city
        from personas
        order by created_at asc nulls last
      `,
    ).then((result) => result.rows),
    queryPostgres<Pick<UserCharacterRecord, "id" | "name">>(
      `
        select id, name
        from user_characters
        order by created_at asc nulls last
      `,
    ).then((result) => result.rows),
    queryPostgres<MemoryScopeOption>(
      `
        with scope_keys as (
          select distinct user_id, persona_id, character_id
          from memories
          where character_id is not null

          union

          select distinct user_id, persona_id, character_id
          from sessions
          where character_id is not null
        ),
        memory_counts as (
          select
            user_id,
            persona_id,
            character_id,
            count(*)::int as memory_count
          from memories
          where character_id is not null
          group by user_id, persona_id, character_id
        ),
        session_counts as (
          select
            user_id,
            persona_id,
            character_id,
            count(*)::int as session_count,
            max(last_message_at) as last_activity_at
          from sessions
          where character_id is not null
          group by user_id, persona_id, character_id
        )
        select
          scope_keys.user_id as "userId",
          profiles.nickname as "userNickname",
          auth_users.email as "userEmail",
          scope_keys.persona_id as "personaId",
          personas.name as "personaName",
          personas.occupation as "personaOccupation",
          personas.city as "personaCity",
          personas.is_active as "personaIsActive",
          scope_keys.character_id as "characterId",
          user_characters.name as "characterName",
          user_characters.is_active as "characterIsActive",
          coalesce(memory_counts.memory_count, 0) as "memoryCount",
          coalesce(session_counts.session_count, 0) as "sessionCount",
          session_counts.last_activity_at as "lastActivityAt"
        from scope_keys
        left join profiles on profiles.id = scope_keys.user_id
        left join auth.users as auth_users on auth_users.id = scope_keys.user_id
        left join personas on personas.id = scope_keys.persona_id
        left join user_characters on user_characters.id = scope_keys.character_id
        left join memory_counts
          on memory_counts.user_id = scope_keys.user_id
         and memory_counts.persona_id = scope_keys.persona_id
         and memory_counts.character_id = scope_keys.character_id
        left join session_counts
          on session_counts.user_id = scope_keys.user_id
         and session_counts.persona_id = scope_keys.persona_id
         and session_counts.character_id = scope_keys.character_id
        order by
          session_counts.last_activity_at desc nulls last,
          personas.created_at desc nulls last,
          user_characters.created_at desc nulls last
      `,
    ).then((result) => result.rows),
  ]);

  return (
    <MemoriesClient
      users={users}
      personas={personas}
      characters={characters}
      scopes={scopes}
    />
  );
}
