import { listPromptVersions } from "@/lib/ai/prompt-versions";
import { listAppUsers } from "@/lib/auth/session";
import { getEvaluationOverview, listEvaluationLogs } from "@/lib/evaluation/logs";
import { queryPostgres } from "@/lib/postgres";
import type { Persona } from "@/lib/supabase/types";
import TestingClient from "./TestingClient";

export default async function AdminTestingPage() {
  const [users, promptVersions, overview, recentLogs, personas] =
    await Promise.all([
      listAppUsers(),
      listPromptVersions(),
      getEvaluationOverview(),
      listEvaluationLogs({ limit: 20 }),
      queryPostgres<Pick<Persona, "id" | "name" | "occupation" | "city">>(
        `
          select id, name, occupation, city
          from personas
          order by created_at asc nulls last
        `,
      ).then((result) => result.rows),
    ]);

  return (
    <TestingClient
      users={users}
      promptVersions={promptVersions}
      personas={personas}
      initialEvaluationData={{
        overview,
        recentLogs,
      }}
    />
  );
}
