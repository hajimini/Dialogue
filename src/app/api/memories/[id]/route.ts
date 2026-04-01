import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { deleteMemory } from "@/lib/memory/long-term";
import { memoryContextCache } from "@/lib/memory/memory-context-cache";
import { getMemorySupabaseClient, resolveMemoryStorageUserId } from "@/lib/memory/storage";
import { memoryLogger } from "@/lib/memory/memory-logger";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Please login first." } },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const storageUserId = await resolveMemoryStorageUserId(user.id);
    const supabase = getMemorySupabaseClient();
    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .eq("id", id)
      .eq("user_id", storageUserId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "记忆不存在或无权限删除。" } },
        { status: 404 },
      );
    }

    const startTime = Date.now();
    await deleteMemory(id);
    memoryContextCache.invalidate(user.id, data.persona_id);
    await memoryLogger.log({
      timestamp: new Date().toISOString(),
      operation: "memory.delete",
      user_id: user.id,
      persona_id: data.persona_id,
      memory_id: id,
      duration: Date.now() - startTime,
      success: true,
      metadata: { source: "user-api" },
    });

    return NextResponse.json({
      success: true,
      data: { id },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除记忆失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
