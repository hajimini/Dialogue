import { NextResponse } from "next/server";
import { attachAuthCookie, authenticateLocalUser } from "@/lib/auth/session";

function sanitizeNextPath(value: unknown, fallback: string) {
  if (typeof value === "string" && value.startsWith("/")) {
    return value;
  }

  return fallback;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "请输入邮箱和密码。" },
        },
        { status: 400 },
      );
    }

    const user = await authenticateLocalUser(email, password);
    const fallbackPath = user.role === "admin" ? "/admin/dashboard" : "/";
    const nextUrl = sanitizeNextPath(body.next, fallbackPath);
    const response = NextResponse.json({
      success: true,
      data: {
        user,
        next_url: user.role === "admin" && nextUrl === "/" ? fallbackPath : nextUrl,
      },
      error: null,
    });

    return attachAuthCookie(response, user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录时出现未知错误。";

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { message },
      },
      { status: 400 },
    );
  }
}
