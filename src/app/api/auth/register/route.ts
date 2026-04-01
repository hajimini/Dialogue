import { NextResponse } from "next/server";
import { attachAuthCookie, registerLocalUser } from "@/lib/auth/session";

function sanitizeNextPath(value: unknown, fallback: string) {
  if (typeof value === "string" && value.startsWith("/")) {
    return value;
  }

  return fallback;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const user = await registerLocalUser({
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
      nickname: typeof body.nickname === "string" ? body.nickname : "",
    });
    const nextUrl = sanitizeNextPath(body.next, "/");
    const response = NextResponse.json({
      success: true,
      data: {
        user,
        next_url: nextUrl,
      },
      error: null,
    });

    return attachAuthCookie(response, user);
  } catch (error) {
    const message = error instanceof Error ? error.message : "注册时出现未知错误。";

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
