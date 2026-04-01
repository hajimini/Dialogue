import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const body = (await request.json()) as {
      userId: string;
      personaId: string;
      characterId?: string;
      threshold?: number;
    };

    const { userId, personaId, characterId, threshold = 0.95 } = body;

    if (!userId || !personaId) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必要参数" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    // 获取该用户和人设的所有记忆
    let query = supabase
      .from("memories")
      .select("id, content, memory_type, importance, created_at, embedding")
      .eq("user_id", userId)
      .eq("persona_id", personaId);

    if (characterId) {
      query = query.eq("character_id", characterId);
    }

    const { data: memories, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw new Error(`读取记忆失败: ${error.message}`);
    }

    if (!memories || memories.length === 0) {
      return NextResponse.json({
        success: true,
        data: { duplicates: [] },
      });
    }

    // 使用向量相似度检测重复
    const duplicateGroups: Array<{
      group_id: string;
      memories: Array<{
        id: string;
        content: string;
        memory_type: string;
        importance: number;
        created_at: string;
        similarity: number;
      }>;
      max_similarity: number;
    }> = [];

    const processed = new Set<string>();

    for (let i = 0; i < memories.length; i++) {
      if (processed.has(memories[i].id)) continue;

      const group: Array<{
        id: string;
        content: string;
        memory_type: string;
        importance: number;
        created_at: string;
        similarity: number;
      }> = [
        {
          id: memories[i].id,
          content: memories[i].content,
          memory_type: memories[i].memory_type,
          importance: Number(memories[i].importance),
          created_at: memories[i].created_at,
          similarity: 1.0,
        },
      ];

      // 查找相似的记忆
      for (let j = i + 1; j < memories.length; j++) {
        if (processed.has(memories[j].id)) continue;

        // 使用向量相似度
        if (memories[i].embedding && memories[j].embedding) {
          const { data: similarityData } = await supabase.rpc(
            "match_memories",
            {
              query_embedding: memories[i].embedding,
              match_threshold: threshold,
              match_count: 1,
              filter_user_id: userId,
              filter_persona_id: personaId,
            },
          );

          if (
            similarityData &&
            similarityData.length > 0 &&
            similarityData[0].id === memories[j].id
          ) {
            group.push({
              id: memories[j].id,
              content: memories[j].content,
              memory_type: memories[j].memory_type,
              importance: Number(memories[j].importance),
              created_at: memories[j].created_at,
              similarity: similarityData[0].similarity,
            });
            processed.add(memories[j].id);
          }
        } else {
          // 简单的文本相似度（Jaccard相似度）
          const words1 = new Set(memories[i].content.split(/\s+/));
          const words2 = new Set(memories[j].content.split(/\s+/));
          const intersection = new Set(
            [...words1].filter((word) => words2.has(word)),
          );
          const union = new Set([...words1, ...words2]);
          const similarity = intersection.size / union.size;

          if (similarity >= threshold) {
            group.push({
              id: memories[j].id,
              content: memories[j].content,
              memory_type: memories[j].memory_type,
              importance: Number(memories[j].importance),
              created_at: memories[j].created_at,
              similarity,
            });
            processed.add(memories[j].id);
          }
        }
      }

      if (group.length > 1) {
        const maxSimilarity = Math.max(...group.map((m) => m.similarity));
        duplicateGroups.push({
          group_id: `group_${i}`,
          memories: group.sort((a, b) => b.similarity - a.similarity),
          max_similarity: maxSimilarity,
        });
        processed.add(memories[i].id);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        duplicates: duplicateGroups,
        total_groups: duplicateGroups.length,
        total_duplicates: duplicateGroups.reduce(
          (sum, group) => sum + group.memories.length,
          0,
        ),
      },
    });
  } catch (error) {
    console.error("Duplicate detection error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "去重检测失败",
        },
      },
      { status: 500 },
    );
  }
}
