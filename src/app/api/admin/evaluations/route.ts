import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { createEvaluationLog, getEvaluationOverview, listEvaluationLogs } from "@/lib/evaluation/logs";

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

    const [overview, recentLogs] = await Promise.all([
      getEvaluationOverview(),
      listEvaluationLogs({ limit: 20 }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        overview,
        recentLogs,
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取评估数据失败。";
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

    const body = (await req.json()) as Record<string, unknown>;
    const log = await createEvaluationLog({
      userId: typeof body.userId === "string" ? body.userId : null,
      personaId: typeof body.personaId === "string" ? body.personaId : null,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      messageId: typeof body.messageId === "string" ? body.messageId : null,
      promptVersion:
        typeof body.promptVersion === "string" ? body.promptVersion : null,
      roleAdherence:
        typeof body.roleAdherence === "number" ? body.roleAdherence : null,
      naturalness: typeof body.naturalness === "number" ? body.naturalness : null,
      emotionalAccuracy:
        typeof body.emotionalAccuracy === "number" ? body.emotionalAccuracy : null,
      memoryAccuracy:
        typeof body.memoryAccuracy === "number" ? body.memoryAccuracy : null,
      antiAiScore: typeof body.antiAiScore === "number" ? body.antiAiScore : null,
      lengthAppropriate:
        typeof body.lengthAppropriate === "number" ? body.lengthAppropriate : null,
      evaluator: user.email,
      notes: typeof body.notes === "string" ? body.notes : null,
      feedbackType:
        body.feedbackType === "up" || body.feedbackType === "down"
          ? body.feedbackType
          : null,
      feedbackReason:
        typeof body.feedbackReason === "string" ? body.feedbackReason : null,
      source:
        body.source === "admin-panel" ||
        body.source === "quick-test" ||
        body.source === "batch-test" ||
        body.source === "auto"
          ? body.source
          : "admin-panel",
    });

    return NextResponse.json({
      success: true,
      data: log,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存评估结果失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
