import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { deleteSession } from "@/lib/chat/sessions";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Please login first." } },
        { status: 401 },
      );
    }

    const { sessionId } = await context.params;
    const result = await deleteSession(sessionId, { userId: user.id });

    return NextResponse.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误（删除会话）";

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
