import { queryPostgres } from "@/lib/postgres";
import MemoryStatsClient from "./MemoryStatsClient";

export default async function MemoryStatsPage() {
  const [users, personas, characters] = await Promise.all([
    queryPostgres<{ id: string; nickname: string }>(
      `
        select id, coalesce(nickname, '') as nickname
        from profiles
        order by created_at desc nulls last
      `,
    ).then((result) => result.rows),
    queryPostgres<{ id: string; name: string }>(
      `
        select id, name
        from personas
        where is_active = true
        order by created_at desc nulls last
      `,
    ).then((result) => result.rows),
    queryPostgres<{ id: string; name: string }>(
      `
        select id, name
        from user_characters
        order by created_at desc nulls last
      `,
    ).then((result) => result.rows),
  ]);

  if (users.length === 0 || personas.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdfcfa]">
        <div className="rounded-[28px] border border-[#e7eee9] bg-white/90 p-8 text-center shadow-lg">
          <div className="text-lg font-semibold text-[#173128]">无法加载数据</div>
          <div className="mt-2 text-sm text-[#66766f]">
            {users.length === 0 && "没有找到用户数据"}
            {personas.length === 0 && "没有找到人设数据"}
          </div>
        </div>
      </div>
    );
  }

  return <MemoryStatsClient users={users} personas={personas} characters={characters} />;
}
