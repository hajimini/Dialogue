import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { configService, type EditableMemoryConfig } from "@/lib/memory/config-service";

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Admin access required." } },
        { status: user ? 403 : 401 },
      );
    }

    const body = (await req.json()) as {
      provider?: "embedding" | "reranker";
      config?: EditableMemoryConfig;
    };

    if (!body.provider) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "provider 为必填项。" } },
        { status: 400 },
      );
    }

    const result = await configService.testConnection(body.provider, body.config ?? {});

    return NextResponse.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "测试配置连接失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
