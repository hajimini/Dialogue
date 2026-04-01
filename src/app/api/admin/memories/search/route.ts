import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { getMemoryGateway } from "@/lib/memory/factory";
import { memoryLogger } from "@/lib/memory/memory-logger";

type SearchBody = {
  user_id?: string;
  persona_id?: string;
  character_id?: string;
  query?: string;
  limit?: number;
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Admin access required." } },
        { status: user ? 403 : 401 },
      );
    }

    const body = (await req.json()) as SearchBody;
    const userId = body.user_id?.trim() || "";
    const personaId = body.persona_id?.trim() || "";
    const characterId = body.character_id?.trim() || "";
    const query = body.query?.trim() || "";
    const limit = Math.max(1, Math.min(10, body.limit ?? 5));

    if (!userId || !personaId || !characterId || !query) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "user_id、persona_id、character_id、query 为必填项。" } },
        { status: 400 },
      );
    }

    const result = await getMemoryGateway().search({
      userId,
      personaId,
      characterId,
      query,
      limit,
    });

    await memoryLogger.log({
      timestamp: new Date().toISOString(),
      operation: "memory.admin_search",
      user_id: user.id,
      persona_id: personaId,
      character_id: characterId,
      duration: result.totalTime ?? 0,
      success: true,
      metadata: {
        target_user_id: userId,
        query,
        limit,
        result_count: result.memories.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        memories:
          result.scoredMemories?.map((item) => ({
            memory: item.memory,
            similarity_score: item.similarityScore,
            reranker_score: item.rerankerScore,
            final_rank: item.finalRank,
          })) ?? [],
        embedding_time: result.embeddingTime ?? 0,
        search_time: result.searchTime ?? 0,
        rerank_time: result.rerankTime ?? 0,
        total_time: result.totalTime ?? 0,
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "测试记忆检索失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
