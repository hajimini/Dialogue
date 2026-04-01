import Link from "next/link";
import { queryPostgres } from "@/lib/postgres";

export default async function AdminPersonasPage() {
  const data = await queryPostgres<{
    id: string;
    name: string;
    avatar_url: string | null;
    occupation: string | null;
    city: string | null;
    is_active: boolean;
    updated_at: string | null;
  }>(
    `
      select id, name, avatar_url, occupation, city, is_active, updated_at
      from personas
      order by updated_at desc nulls last
    `,
  ).then((result) => result.rows);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 py-8">
      <section className="overflow-hidden rounded-[32px] border border-[#d9e6df] bg-[radial-gradient(circle_at_top_left,_rgba(43,111,83,0.16),_transparent_36%),linear-gradient(135deg,_rgba(255,252,247,0.98),_rgba(245,251,248,0.96))] p-6 shadow-[0_20px_60px_rgba(35,63,52,0.08)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-[#6c7a73]">
              Persona Management
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#173128]">
              人设管理
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5f6f67]">
              管理系统中的 AI 人设，每个人设代表一个独特的对话角色。用户可以选择不同人设进行一对一角色对话。
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin/dashboard"
              className="rounded-full border border-[#c8dbd2] bg-white/80 px-5 py-3 text-sm font-medium text-[#214f3e] transition hover:bg-[#f3faf6]"
            >
              返回仪表盘
            </Link>
            <Link
              href="/admin/personas/new"
              className="rounded-full bg-[#1f6b50] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#17563f]"
            >
              新建人设
            </Link>
          </div>
        </div>
      </section>


      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(data ?? []).map((p) => (
          <div
            key={p.id}
            className="rounded-[24px] border border-[#dde8e2] bg-white p-6 shadow-[0_18px_50px_rgba(46,69,58,0.08)] transition hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.avatar_url}
                  alt={p.name}
                  className="w-14 h-14 rounded-full object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#edf7f2] flex items-center justify-center text-lg font-semibold text-[#2f7a5b]">
                  {p.name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold text-[#173128] truncate">{p.name}</div>
                <div className="text-sm text-[#66766f] truncate mt-1">
                  {(p.occupation || "未填写") + (p.city ? ` · ${p.city}` : "")}
                </div>
              </div>
              <div className="text-xs">
                {p.is_active ? (
                  <span className="rounded-full bg-[#edf7f2] px-3 py-1 text-[#2f684f]">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full bg-[#f6f6f6] px-3 py-1 text-[#6d6257]">
                    Inactive
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Link
                href={`/admin/personas/${p.id}/edit`}
                className="rounded-full border border-[#d7e6df] bg-white px-5 py-2 text-sm font-medium text-[#35584a] transition hover:bg-[#f7fbf8]"
              >
                编辑
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
