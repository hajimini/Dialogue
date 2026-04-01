import { requireAdminUser } from "@/lib/auth/session";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminUser("/admin/dashboard");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#faf7f1,_#f5fbf8)] text-[#1b2723]">
      <header className="sticky top-0 z-20 border-b border-[#e6ddd0] bg-[rgba(253,250,244,0.88)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-[#7a6a57]">
              Admin Console
            </div>
            <div className="mt-1 text-xl font-semibold">AI Companion 管理后台</div>
          </div>
          <AdminNav />

          <div className="flex items-center gap-3 text-sm text-[#5e5248]">
            <div className="rounded-full border border-[#e4ddd2] bg-white/80 px-4 py-2">
              {admin.nickname} · {admin.email}
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-[#e4ddd2] bg-white/80 px-4 py-2 transition-colors hover:bg-[#f7ede2]"
              >
                退出
              </button>
            </form>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
