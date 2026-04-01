import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { configService, type EditableMemoryConfig } from "@/lib/memory/config-service";

function unauthorizedResponse(userRole?: string) {
  return NextResponse.json(
    { success: false, data: null, error: { message: "Admin access required." } },
    { status: userRole ? 403 : 401 },
  );
}

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return unauthorizedResponse(user?.role);
    }

    const [current, history] = await Promise.all([
      configService.getCurrentConfig(),
      configService.getConfigHistory(10),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        current,
        history,
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取记忆配置失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return unauthorizedResponse(user?.role);
    }

    const body = (await req.json()) as { config?: EditableMemoryConfig };
    if (!body.config || typeof body.config !== "object") {
      return NextResponse.json(
        { success: false, data: null, error: { message: "config 为必填项。" } },
        { status: 400 },
      );
    }

    const result = await configService.updateConfig(body.config, user.email);

    return NextResponse.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新记忆配置失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
