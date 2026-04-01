"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AuthFormProps = {
  mode: "login" | "register";
  nextPath?: string;
  hints?: {
    demoUser?: { email: string; password: string };
    adminUser?: { email: string; password: string };
  };
};

function sanitizeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/";
  }

  return nextPath;
}

export default function AuthForm({ mode, nextPath, hints }: AuthFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState(
    mode === "login" ? hints?.demoUser?.email ?? "" : "",
  );
  const [password, setPassword] = useState(
    mode === "login" ? hints?.demoUser?.password ?? "" : "",
  );
  const [nickname, setNickname] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);

  const targetPath = useMemo(() => sanitizeNextPath(nextPath), [nextPath]);

  function fillDemo(type: "user" | "admin") {
    const account = type === "admin" ? hints?.adminUser : hints?.demoUser;
    if (!account) return;
    setEmail(account.email);
    setPassword(account.password);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText(null);

    startTransition(async () => {
      try {
        const response = await fetch(
          mode === "login" ? "/api/auth/login" : "/api/auth/register",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              password,
              nickname,
              next: targetPath,
            }),
          },
        );
        const json = (await response.json()) as {
          success: boolean;
          data: { next_url: string } | null;
          error: { message: string } | null;
        };

        if (!json.success || !json.data) {
          throw new Error(json.error?.message || "认证失败");
        }

        router.replace(json.data.next_url);
        router.refresh();
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : "认证流程出现未知错误");
      }
    });
  }

  return (
    <div className="w-full max-w-md rounded-[30px] border border-white/50 bg-white/80 p-8 shadow-[0_40px_100px_rgba(33,72,56,0.12)] backdrop-blur">
      <div className="text-xs uppercase tracking-[0.26em] text-[#568172]">
        {mode === "login" ? "Welcome Back" : "Create Account"}
      </div>
      <h1 className="mt-4 text-3xl font-semibold text-[#163127]">
        {mode === "login" ? "登录后继续聊天" : "创建一个新的聊天账号"}
      </h1>
      <p className="mt-3 text-sm leading-7 text-[#5a746a]">
        {mode === "login"
          ? "用户端和管理端现在都走统一登录态。你可以先用演示账号快速进入，再慢慢补真实账号体系。"
          : "注册后会直接进入普通用户聊天界面。管理员账号仍然使用预置演示账户登录。"}
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label className="block text-sm font-medium text-[#2b4a3e]">
            昵称
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#d6e7df] bg-white px-4 py-3 outline-none transition focus:border-[#8fb9a7] focus:ring-2 focus:ring-[#d9f0e6]"
              placeholder="聊天时展示给人设看的名字"
            />
          </label>
        ) : null}

        <label className="block text-sm font-medium text-[#2b4a3e]">
          邮箱
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#d6e7df] bg-white px-4 py-3 outline-none transition focus:border-[#8fb9a7] focus:ring-2 focus:ring-[#d9f0e6]"
            placeholder="you@example.com"
          />
        </label>

        <label className="block text-sm font-medium text-[#2b4a3e]">
          密码
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#d6e7df] bg-white px-4 py-3 outline-none transition focus:border-[#8fb9a7] focus:ring-2 focus:ring-[#d9f0e6]"
            placeholder={mode === "login" ? "输入密码" : "至少 6 位"}
          />
        </label>

        {errorText ? (
          <div className="rounded-2xl border border-[#f1d5d5] bg-[#fff5f5] px-4 py-3 text-sm text-[#a43f3f]">
            {errorText}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-full bg-[#1f8a5b] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#22764f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? mode === "login"
              ? "登录中..."
              : "注册中..."
            : mode === "login"
              ? "登录"
              : "注册并进入"}
        </button>
      </form>

      {mode === "login" ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fillDemo("user")}
            className="rounded-full border border-[#d9e8e2] bg-white px-3 py-2 text-xs text-[#305545] transition-colors hover:bg-[#f4faf7]"
          >
            填入普通演示账号
          </button>
          <button
            type="button"
            onClick={() => fillDemo("admin")}
            className="rounded-full border border-[#eadfd0] bg-[#fff9f1] px-3 py-2 text-xs text-[#6b5338] transition-colors hover:bg-[#fff2df]"
          >
            填入管理员演示账号
          </button>
        </div>
      ) : null}

      <div className="mt-6 text-sm text-[#5a746a]">
        {mode === "login" ? "还没有账号？" : "已经有账号了？"}{" "}
        <Link
          href={
            mode === "login"
              ? `/register?next=${encodeURIComponent(targetPath)}`
              : `/login?next=${encodeURIComponent(targetPath)}`
          }
          className="font-medium text-[#1f7b59] underline underline-offset-4"
        >
          {mode === "login" ? "去注册" : "去登录"}
        </Link>
      </div>
    </div>
  );
}
