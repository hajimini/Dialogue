import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { memoryLogger } from "@/lib/memory/memory-logger";

export async function GET(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Admin access required." } },
        { status: user ? 403 : 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.max(
      1,
      Math.min(500, Number.parseInt(searchParams.get("limit") || "250", 10) || 250),
    );
    const offset = Math.max(0, Number.parseInt(searchParams.get("offset") || "0", 10) || 0);
    const operation = searchParams.get("operation")?.trim() || undefined;
    const userId = searchParams.get("user_id")?.trim() || undefined;
    const personaId = searchParams.get("persona_id")?.trim() || undefined;
    const characterId = searchParams.get("character_id")?.trim() || undefined;
    const successParam = searchParams.get("success")?.trim();
    const success =
      successParam === "true" ? true : successParam === "false" ? false : undefined;

    const result = await memoryLogger.query({
      limit,
      offset,
      operation,
      userId,
      personaId,
      characterId,
      success,
    });

    return NextResponse.json({
      success: true,
      data: {
        logs: result.logs,
        total_count: result.totalCount,
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取记忆日志失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
