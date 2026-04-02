import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { checkMemoryGenerationStatus } from "@/lib/chat/memory-generation-status";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "未登录" } },
        { status: 401 }
      );
    }

    const { sessionId } = await context.params;

    const status = await checkMemoryGenerationStatus(sessionId);

    return NextResponse.json({
      success: true,
      data: status,
      error: null,
    });
  } catch (error) {
    console.error("[Memory Status] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "检查失败",
        },
      },
      { status: 500 }
    );
  }
}
