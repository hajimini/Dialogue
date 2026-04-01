import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { memoryContextCache } from "@/lib/memory/memory-context-cache";
import { memoryLogger } from "@/lib/memory/memory-logger";
import { getMemorySupabaseClient, resolveMemoryStorageUserId } from "@/lib/memory/storage";

type FeedbackBody = {
  memory_id?: string;
  feedback_type?: "accurate" | "inaccurate";
  feedback_reason?: string;
};

function isMissingColumnError(message: string | undefined) {
  if (!message) return false;
  return (
    message.includes("feedback_count_accurate") ||
    message.includes("feedback_count_inaccurate") ||
    message.includes("retrieval_count") ||
    message.includes("schema cache")
  );
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Please login first." } },
        { status: 401 },
      );
    }

    const body = (await req.json()) as FeedbackBody;
    const memoryId = body.memory_id?.trim() || "";
    const feedbackType = body.feedback_type;
    const feedbackReason = body.feedback_reason?.trim() || null;

    if (!memoryId || !feedbackType || !["accurate", "inaccurate"].includes(feedbackType)) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "反馈参数不完整。" } },
        { status: 400 },
      );
    }

    const storageUserId = await resolveMemoryStorageUserId(user.id);
    const supabase = getMemorySupabaseClient();
    const { data: memory, error } = await supabase
      .from("memories")
      .select("*")
      .eq("id", memoryId)
      .eq("user_id", storageUserId)
      .single();

    if (error || !memory) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "记忆不存在或无权限反馈。" } },
        { status: 404 },
      );
    }

    const startTime = Date.now();
    const accurateCount = memory.feedback_count_accurate ?? 0;
    const inaccurateCount = memory.feedback_count_inaccurate ?? 0;

    const { error: insertError } = await supabase.from("memory_feedback").insert({
      user_id: storageUserId,
      memory_id: memoryId,
      feedback_type: feedbackType,
      feedback_reason: feedbackReason,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    const nextImportance =
      feedbackType === "inaccurate"
        ? Math.max(0.05, Number(memory.importance ?? 0.5) * 0.5)
        : Number(memory.importance ?? 0.5);

    const fullUpdate = {
      importance: nextImportance,
      feedback_count_accurate:
        feedbackType === "accurate" ? accurateCount + 1 : accurateCount,
      feedback_count_inaccurate:
        feedbackType === "inaccurate" ? inaccurateCount + 1 : inaccurateCount,
      updated_at: new Date().toISOString(),
    };

    let { error: updateError } = await supabase
      .from("memories")
      .update(fullUpdate)
      .eq("id", memoryId);

    if (updateError && isMissingColumnError(updateError.message)) {
      const fallbackUpdate = await supabase
        .from("memories")
        .update({
          importance: nextImportance,
          updated_at: fullUpdate.updated_at,
        })
        .eq("id", memoryId);

      updateError = fallbackUpdate.error;
    }

    if (updateError) {
      throw new Error(updateError.message);
    }

    memoryContextCache.invalidate(user.id, memory.persona_id);
    await memoryLogger.log({
      timestamp: new Date().toISOString(),
      operation: "memory.feedback",
      user_id: user.id,
      persona_id: memory.persona_id,
      memory_id: memoryId,
      duration: Date.now() - startTime,
      success: true,
      metadata: {
        feedback_type: feedbackType,
        feedback_reason: feedbackReason,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        memory_id: memoryId,
        feedback_type: feedbackType,
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交反馈失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
