import { redirect } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";
import { getCurrentAppUser, getDemoCredentialHints } from "@/lib/auth/session";

function resolveNextPath(next?: string | string[]) {
  const value = Array.isArray(next) ? next[0] : next;
  return typeof value === "string" && value.startsWith("/") ? value : "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const [user, params] = await Promise.all([getCurrentAppUser(), searchParams]);

  if (user) {
    redirect(user.role === "admin" ? "/admin/dashboard" : resolveNextPath(params.next));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(31,138,91,0.18),_transparent_25%),linear-gradient(135deg,_#edf7f2,_#fbfffd)] px-6 py-10">
      <AuthForm
        mode="login"
        nextPath={resolveNextPath(params.next)}
        hints={getDemoCredentialHints()}
      />
    </main>
  );
}
