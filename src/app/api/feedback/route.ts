import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { getSessionMessageById } from "@/lib/chat/sessions";
import { createEvaluationLog } from "@/lib/evaluation/logs";

type FeedbackRequest = {
  persona_id?: string;
  session_id?: string;
  message_id?: string;
  feedback_type?: "up" | "down";
  feedback_reason?: string | null;
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Please login first." } },
        { status: 401 },
      );
    }

    const body = (await req.json()) as FeedbackRequest;
    const sessionId =
      typeof body.session_id === "string" ? body.session_id.trim() : "";
    const messageId =
      typeof body.message_id === "string" ? body.message_id.trim() : "";
    const feedbackType = body.feedback_type;

    if (!sessionId || !messageId || (feedbackType !== "up" && feedbackType !== "down")) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "session_id、message_id 和 feedback_type 为必填项。" },
        },
        { status: 400 },
      );
    }

    const targetMessage = await getSessionMessageById(sessionId, messageId, {
      userId: user.id,
    });

    if (!targetMessage || targetMessage.role !== "assistant") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "找不到可反馈的 AI 回复。" },
        },
        { status: 404 },
      );
    }

    const log = await createEvaluationLog({
      userId: user.id,
      personaId:
        typeof body.persona_id === "string" ? body.persona_id.trim() || null : null,
      sessionId,
      messageId,
      feedbackType,
      feedbackReason:
        typeof body.feedback_reason === "string" ? body.feedback_reason : null,
      evaluator: user.email,
      source: "chat-feedback",
    });

    return NextResponse.json({
      success: true,
      data: log,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交反馈时发生未知错误。";

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
