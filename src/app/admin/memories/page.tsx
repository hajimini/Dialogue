import { listAppUsers } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";
import type { Persona, UserCharacterRecord } from "@/lib/supabase/types";
import MemoriesClient from "./MemoriesClient";

export default async function AdminMemoriesPage() {
  const [users, personas, characters] = await Promise.all([
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
  ]);

  return (
    <MemoriesClient
      users={users}
      personas={personas}
      characters={characters}
    />
  );
}
