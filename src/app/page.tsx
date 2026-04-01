import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";

export default async function HomePage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin/dashboard");
  }

  const result = await queryPostgres<{ id: string }>(
    `
      select id
      from personas
      where is_active = true
      order by created_at asc nulls last
      limit 1
    `,
  );
  const data = result.rows[0] ?? null;

  if (!data?.id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f8f6] px-6 text-[#14211d]">
        <div className="w-full max-w-xl rounded-[28px] border border-[#d6e7e0] bg-white/90 p-8 shadow-[0_24px_80px_rgba(25,60,45,0.08)]">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#4b7a69]">
            AI Companion
          </div>
          <h1 className="mt-4 text-3xl font-semibold">暂时还没有可用人设</h1>
          <p className="mt-3 text-sm leading-7 text-[#597267]">
            当前账号已经登录成功，但系统里还没有激活的人设。请让管理员先到后台创建或启用一个人设，然后再回来开始聊天。
          </p>
          <div className="mt-6 rounded-full border border-[#d2e1db] px-4 py-2 text-sm text-[#36574b]">
            当前账号：{user.nickname}
          </div>
        </div>
      </main>
    );
  }

  redirect(`/chat/${data.id}`);
}
