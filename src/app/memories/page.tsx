import { requireAuthenticatedUser } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";
import MemoriesPageClient from "./MemoriesPageClient";

export default async function PersonalMemoriesPage() {
  const user = await requireAuthenticatedUser("/memories");

  const [personasResult, charactersResult] = await Promise.all([
    queryPostgres<{ id: string; name: string }>(
      `
        select id, name
        from personas
        where is_active = true
        order by created_at asc nulls last
      `,
    ),
    queryPostgres<{ id: string; name: string }>(
      `
        select id, name
        from user_characters
        where owner_id = $1
        order by created_at desc nulls last
      `,
      [user.id],
    ),
  ]);

  return <MemoriesPageClient personas={personasResult.rows} characters={charactersResult.rows} />;
}
