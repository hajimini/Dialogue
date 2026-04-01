import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { deleteMemory, updateMemory } from "@/lib/memory/long-term";

function unauthorizedResponse(userRole?: string) {
  return NextResponse.json(
    { success: false, data: null, error: { message: "Admin access required." } },
    { status: userRole ? 403 : 401 },
  );
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ memoryId: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return unauthorizedResponse(user?.role);
    }

    const { memoryId } = await context.params;
    const body = (await req.json()) as Record<string, unknown>;
    const memory = await updateMemory(memoryId, {
      memoryType:
        typeof body.memoryType === "string"
          ? (body.memoryType as Parameters<typeof updateMemory>[1]["memoryType"])
          : undefined,
      content: typeof body.content === "string" ? body.content : undefined,
      importance: typeof body.importance === "number" ? body.importance : undefined,
      sourceSessionId:
        typeof body.sourceSessionId === "string" ? body.sourceSessionId : undefined,
    });

    return NextResponse.json({
      success: true,
      data: memory,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新记忆失败。";

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { message },
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ memoryId: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return unauthorizedResponse(user?.role);
    }

    const { memoryId } = await context.params;
    const deleted = await deleteMemory(memoryId);

    return NextResponse.json({
      success: true,
      data: deleted,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除记忆失败。";

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { message },
      },
      { status: 500 },
    );
  }
}
