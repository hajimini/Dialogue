import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { memoryLogger } from "@/lib/memory/memory-logger";
import { getMemorySupabaseClient, resolveMemoryStorageUserId } from "@/lib/memory/storage";
import type { MemoryRecord, MemoryType } from "@/lib/supabase/types";

export async function GET(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Please login first." } },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const personaId = searchParams.get("persona_id")?.trim() || "";
    const characterId = searchParams.get("character_id")?.trim() || "";
    const memoryType = searchParams.get("memory_type")?.trim() as MemoryType | "";
    const queryText = searchParams.get("q")?.trim() || "";
    const limit = Math.max(
      1,
      Math.min(100, Number.parseInt(searchParams.get("limit") || "50", 10) || 50),
    );
    const offset = Math.max(0, Number.parseInt(searchParams.get("offset") || "0", 10) || 0);
    const storageUserId = await resolveMemoryStorageUserId(user.id);
    const supabase = getMemorySupabaseClient();

    let query = supabase
      .from("memories")
      .select("*", { count: "exact" })
      .eq("user_id", storageUserId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (personaId) {
      query = query.eq("persona_id", personaId);
    }

    if (characterId) {
      query = query.eq("character_id", characterId);
    }

    if (memoryType) {
      query = query.eq("memory_type", memoryType);
    }

    if (queryText) {
      query = query.ilike("content", `%${queryText}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const personaIds = [...new Set((data ?? []).map((item) => item.persona_id))];
    let personaNameMap = new Map<string, string>();

    if (personaIds.length > 0) {
      const { data: personas } = await supabase
        .from("personas")
        .select("id,name")
        .in("id", personaIds);

      personaNameMap = new Map((personas ?? []).map((item) => [item.id, item.name]));
    }

    const memories = ((data ?? []) as MemoryRecord[]).map((memory) => ({
      id: memory.id,
      content: memory.content,
      memory_type: memory.memory_type,
      persona_id: memory.persona_id,
      persona_name: personaNameMap.get(memory.persona_id) ?? "未命名人设",
      source_session_id: memory.source_session_id,
      created_at: memory.created_at,
      updated_at: memory.updated_at,
    }));

    await memoryLogger.log({
      timestamp: new Date().toISOString(),
      operation: "memory.list",
      user_id: user.id,
      persona_id: personaId || null,
      character_id: characterId || null,
      duration: 0,
      success: true,
      metadata: {
        memory_type: memoryType || null,
        query: queryText || null,
        limit,
        offset,
        result_count: memories.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        memories,
        total_count: count ?? memories.length,
        has_more: offset + memories.length < (count ?? memories.length),
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取记忆失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
