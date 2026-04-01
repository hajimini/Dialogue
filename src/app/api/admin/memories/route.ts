import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { listRecentSessionsForAdmin } from "@/lib/chat/sessions";
import { getCurrentMemoryConfigSnapshot } from "@/lib/memory/config";
import { memoryLogger } from "@/lib/memory/memory-logger";
import {
  createMemory,
  getUserProfileForPersona,
  listMemories,
} from "@/lib/memory/long-term";
import {
  getMemorySupabaseClient,
  resolveMemoryStorageUserId,
} from "@/lib/memory/storage";
import type { MemoryType } from "@/lib/supabase/types";

function unauthorizedResponse(userRole?: string) {
  return NextResponse.json(
    { success: false, data: null, error: { message: "Admin access required." } },
    { status: userRole ? 403 : 401 },
  );
}

function normalizeVector(input: unknown): number[] {
  if (Array.isArray(input)) {
    return input
      .map((value) => (typeof value === "number" ? value : Number(value)))
      .filter((value) => Number.isFinite(value));
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    const normalized = trimmed.startsWith("[") && trimmed.endsWith("]")
      ? trimmed.slice(1, -1)
      : trimmed;

    return normalized
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
  }

  return [];
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return unauthorizedResponse(user?.role);
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId")?.trim();
    const personaId = searchParams.get("personaId")?.trim();
    const characterId = searchParams.get("characterId")?.trim();
    const query = searchParams.get("q")?.trim() || undefined;
    const memoryType = (searchParams.get("memoryType")?.trim() || undefined) as
      | MemoryType
      | undefined;
    const limit = Math.max(
      1,
      Math.min(80, Number.parseInt(searchParams.get("limit") || "40", 10) || 40),
    );
    const offset = Math.max(
      0,
      Number.parseInt(searchParams.get("offset") || "0", 10) || 0,
    );

    if (!userId || !personaId) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "userId 和 personaId 为必填参数。" },
        },
        { status: 400 },
      );
    }

    const currentConfig = getCurrentMemoryConfigSnapshot();
    const storageUserId = await resolveMemoryStorageUserId(userId);
    const supabase = getMemorySupabaseClient();

    let countQuery = supabase
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", storageUserId)
      .eq("persona_id", personaId);

    if (characterId) {
      countQuery = countQuery.eq("character_id", characterId);
    }

    if (memoryType) {
      countQuery = countQuery.eq("memory_type", memoryType);
    }

    if (query) {
      countQuery = countQuery.ilike("content", `%${query}%`);
    }

    const [memories, profile, sessions, countResult] = await Promise.all([
      listMemories(userId, personaId, {
        limit,
        offset,
        query,
        memoryType,
        characterId,
      }),
      characterId ? getUserProfileForPersona(userId, personaId, characterId) : Promise.resolve(null),
      listRecentSessionsForAdmin(200),
      countQuery,
    ]);

    if (countResult.error) {
      throw new Error(countResult.error.message);
    }

    const summaries = sessions
      .filter((session) => session.user_id === userId && session.persona_id === personaId)
      .filter((session) => !characterId || session.character_id === characterId)
      .filter((session) => Boolean(session.summary))
      .slice(0, 12);

    await memoryLogger.log({
      timestamp: new Date().toISOString(),
      operation: "memory.admin_snapshot",
      user_id: user.id,
      persona_id: personaId,
      character_id: characterId ?? null,
      duration: 0,
      success: true,
      metadata: {
        target_user_id: userId,
        memory_count: memories.length,
        total_count: countResult.count ?? memories.length,
        summary_count: summaries.length,
        has_profile: Boolean(profile),
        query: query ?? null,
        memory_type: memoryType ?? null,
        limit,
        offset,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        memories: memories.map((memory) => {
          const embedding = normalizeVector(memory.embedding);

          return {
            ...memory,
            embedding,
            embedding_provider: currentConfig.EMBEDDING_PROVIDER,
            embedding_model: currentConfig.EMBEDDING_MODEL,
            embedding_dimension: embedding.length || null,
            vector_preview: embedding.slice(0, 10),
            feedback_count_accurate: memory.feedback_count_accurate ?? 0,
            feedback_count_inaccurate: memory.feedback_count_inaccurate ?? 0,
            retrieval_count: memory.retrieval_count ?? 0,
            needs_review: (memory.feedback_count_inaccurate ?? 0) >= 3,
          };
        }),
        profile,
        summaries,
        total_count: countResult.count ?? memories.length,
        has_more: offset + memories.length < (countResult.count ?? memories.length),
        config: currentConfig,
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取记忆列表失败。";

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

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return unauthorizedResponse(user?.role);
    }

    const body = (await req.json()) as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const personaId =
      typeof body.personaId === "string" ? body.personaId.trim() : "";
    const characterId =
      typeof body.characterId === "string" ? body.characterId.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const memoryType =
      typeof body.memoryType === "string" ? body.memoryType.trim() : "";

    if (!userId || !personaId || !characterId || !content || !memoryType) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "userId、personaId、characterId、memoryType 和 content 为必填项。" },
        },
        { status: 400 },
      );
    }

    const memory = await createMemory({
      userId,
      personaId,
      characterId,
      memoryType: memoryType as Parameters<typeof createMemory>[0]["memoryType"],
      content,
      importance:
        typeof body.importance === "number" ? body.importance : undefined,
      sourceSessionId:
        typeof body.sourceSessionId === "string" ? body.sourceSessionId : null,
    });

    return NextResponse.json({
      success: true,
      data: memory,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建记忆失败。";

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
