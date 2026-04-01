import { queryPostgres } from "@/lib/postgres";

export default async function DiagnosticPage() {
  const [usersResult, personasResult, memoriesResult] = await Promise.all([
    queryPostgres<{ id: string; nickname: string | null }>(
      `
        select id, nickname
        from profiles
        limit 5
      `,
    ),
    queryPostgres<{ id: string; name: string }>(
      `
        select id, name
        from personas
        limit 5
      `,
    ),
    queryPostgres<{
      id: string;
      user_id: string;
      persona_id: string;
      memory_type: string;
      content: string;
      retrieval_count: number | null;
    }>(
      `
        select id, user_id, persona_id, memory_type, content, retrieval_count
        from memories
        limit 10
      `,
    ),
  ]);

  const users = usersResult.rows;
  const personas = personasResult.rows;
  const memories = memoriesResult.rows;
  const usersError = null;
  const personasError = null;
  const memoriesError = null;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">数据库诊断</h1>

      <div className="mt-6 space-y-6">
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">用户数据</h2>
          {usersError ? (
            <pre className="mt-2 text-red-600">{JSON.stringify(usersError, null, 2)}</pre>
          ) : (
            <pre className="mt-2 text-sm">{JSON.stringify(users, null, 2)}</pre>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">人设数据</h2>
          {personasError ? (
            <pre className="mt-2 text-red-600">{JSON.stringify(personasError, null, 2)}</pre>
          ) : (
            <pre className="mt-2 text-sm">{JSON.stringify(personas, null, 2)}</pre>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">记忆数据</h2>
          {memoriesError ? (
            <pre className="mt-2 text-red-600">{JSON.stringify(memoriesError, null, 2)}</pre>
          ) : (
            <pre className="mt-2 text-sm">{JSON.stringify(memories, null, 2)}</pre>
          )}
          <div className="mt-2 text-sm text-gray-600">
            总数: {memories?.length || 0}
          </div>
        </section>

        {users && users.length > 0 && personas && personas.length > 0 && (
          <section className="rounded-lg border bg-blue-50 p-4">
            <h2 className="text-lg font-semibold">测试链接</h2>
            <div className="mt-2 space-y-2">
              <a
                href={`/admin/memories/stats?userId=${users[0].id}&personaId=${personas[0].id}`}
                className="block text-blue-600 hover:underline"
              >
                统计页面: {users[0].nickname} + {personas[0].name}
              </a>
              <a
                href={`/api/admin/memories/stats?userId=${users[0].id}&personaId=${personas[0].id}`}
                className="block text-blue-600 hover:underline"
                target="_blank"
              >
                API测试: 查看原始数据
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
